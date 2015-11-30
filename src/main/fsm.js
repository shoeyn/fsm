var greekLetterNames = [ 'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega' ];

function convertLatexShortcuts(text) {
	// html greek characters
	for(var i = 0; i < greekLetterNames.length; i++) {
		var name = greekLetterNames[i];
		text = text.replace(new RegExp('\\\\' + name, 'g'), String.fromCharCode(913 + i + (i > 16)));
		text = text.replace(new RegExp('\\\\' + name.toLowerCase(), 'g'), String.fromCharCode(945 + i + (i > 16)));
	}

	// subscripts
	for(var i = 0; i < 10; i++) {
		text = text.replace(new RegExp('_' + i, 'g'), String.fromCharCode(8320 + i));
	}

	return text;
}

function textToXML(text) {
	text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	var result = '';
	for(var i = 0; i < text.length; i++) {
		var c = text.charCodeAt(i);
		if(c >= 0x20 && c <= 0x7E) {
			result += text[i];
		} else {
			result += '&#' + c + ';';
		}
	}
	return result;
}

function drawArrow(c, x, y, angle) {
	var dx = Math.cos(angle);
	var dy = Math.sin(angle);
	c.beginPath();
	c.moveTo(x, y);
	c.lineTo(x - 8 * dx + 5 * dy, y - 8 * dy - 5 * dx);
	c.lineTo(x - 8 * dx - 5 * dy, y - 8 * dy + 5 * dx);
	c.fill();
}

function canvasHasFocus() {
	return (document.activeElement || document.body) == document.body;
}

function drawText(c, originalText, x, y, angleOrNull, isSelected) {
	text = convertLatexShortcuts(originalText);
	c.font = '20px "Times New Roman", serif';
	var width = c.measureText(text).width;

	// center the text
	x -= width / 2;

	// position the text intelligently if given an angle
	if(angleOrNull !== null) {
		var cos = Math.cos(angleOrNull);
		var sin = Math.sin(angleOrNull);
		var cornerPointX = (width / 2 + 5) * (cos > 0 ? 1 : -1);
		var cornerPointY = (10 + 5) * (sin > 0 ? 1 : -1);
		var slide = sin * Math.pow(Math.abs(sin), 40) * cornerPointX - cos * Math.pow(Math.abs(cos), 10) * cornerPointY;
		x += cornerPointX - sin * slide;
		y += cornerPointY + cos * slide;
	}

	// draw text and caret (round the coordinates so the caret falls on a pixel)
	if('advancedFillText' in c) {
		c.advancedFillText(text, originalText, x + width / 2, y, angleOrNull);
	} else {
		x = Math.round(x);
		y = Math.round(y);
		c.fillText(text, x, y + 6);
		if(isSelected && caretVisible && canvasHasFocus() && document.hasFocus()) {
			x += width;
			c.beginPath();
			c.moveTo(x, y - 10);
			c.lineTo(x, y + 10);
			c.stroke();
		}
	}
}

var caretTimer;
var caretVisible = true;

function resetCaret() {
	clearInterval(caretTimer);
	caretTimer = setInterval('caretVisible = !caretVisible; draw()', 500);
	caretVisible = true;
}

var canvas;
var context;
var scale = 1;
var originx = 0;
var originy = 0;
var nodeRadius = 30;
var nodes = [];
var links = [];
var mouseDown;

var cursorVisible = true;
var snapToPadding = 6; // pixels
var hitTargetPadding = 6; // pixels
var selectedObject = null; // either a Link or a Node
var currentLink = null; // a Link
var movingObject = false;
var originalClick;

function drawUsing(c) {
	var p1 = context.transformedPoint(0,0);
	var p2 = context.transformedPoint(canvas.width,canvas.height);
	c.clearRect(p1.x,p1.y,p2.x-p1.x,p2.y-p1.y);
	c.save();

	for(var i = 0; i < nodes.length; i++) {
		c.lineWidth = 1;
		c.fillStyle = c.strokeStyle = (nodes[i] == selectedObject) ? 'blue' : 'black';
		nodes[i].draw(c);
	}
	for(var i = 0; i < links.length; i++) {
		c.lineWidth = 1;
		c.fillStyle = c.strokeStyle = (links[i] == selectedObject) ? 'blue' : 'black';
		links[i].draw(c);
	}
	if(currentLink !== null) {
		c.lineWidth = 1;
		c.fillStyle = c.strokeStyle = 'black';
		currentLink.draw(c);
	}

	c.restore();
}

function draw() {
	drawUsing(context);
	saveBackup();
}

function selectObject(x, y) {
	for(var i = 0; i < nodes.length; i++) {
		if(nodes[i].containsPoint(x, y)) {
			return nodes[i];
		}
	}
	for(var i = 0; i < links.length; i++) {
		if(links[i].containsPoint(x, y)) {
			return links[i];
		}
	}
	return null;
}

function snapNode(node) {
	for(var i = 0; i < nodes.length; i++) {
		if(nodes[i] == node) continue;

		if(Math.abs(node.x - nodes[i].x) < snapToPadding) {
			node.x = nodes[i].x;
		}

		if(Math.abs(node.y - nodes[i].y) < snapToPadding) {
			node.y = nodes[i].y;
		}
	}
}

window.onload = function() {
	canvas = document.getElementById('canvas');
	context = canvas.getContext('2d');
	trackTransforms(context);
	restoreBackup();
	draw();

	canvas.onmousedown = function(e) {
		var mouse = crossBrowserMousePos(e);
		selectedObject = selectObject(mouse.x, mouse.y);
		movingObject = false;
		originalClick = mouse;

		if(selectedObject !== null) {
			if(shift && selectedObject instanceof Node) {
				currentLink = new SelfLink(selectedObject, mouse);
			} else {
				movingObject = true;
				deltaMouseX = deltaMouseY = 0;
				if(selectedObject.setMouseStart) {
					selectedObject.setMouseStart(mouse.x, mouse.y);
				}
			}
			resetCaret();
		} else if(shift) {
			currentLink = new TemporaryLink(mouse, mouse);
		} else {
			mouseDown = true;
		}

		draw();

		if(canvasHasFocus()) {
			// disable drag-and-drop only if the canvas is already focused
			return false;
		} else {
			// otherwise, let the browser switch the focus away from wherever it was
			resetCaret();
			return true;
		}
	};

	canvas.ondblclick = function(e) {
		var mouse = crossBrowserMousePos(e);
		selectedObject = selectObject(mouse.x, mouse.y);

		if(selectedObject === null) {
			selectedObject = new Node(mouse.x, mouse.y);
			nodes.push(selectedObject);
			resetCaret();
			draw();
		} else if(selectedObject instanceof Node) {
			selectedObject.isAcceptState = !selectedObject.isAcceptState;
			draw();
		}
	};

	canvas.onmousemove = function(e) {
		var mouse = crossBrowserMousePos(e);

		if(currentLink !== null) {
			var targetNode = selectObject(mouse.x, mouse.y);
			if(!(targetNode instanceof Node)) {
				targetNode = null;
			}

			if(selectedObject === null) {
				if(targetNode !== null) {
					currentLink = new StartLink(targetNode, originalClick);
				} else {
					currentLink = new TemporaryLink(originalClick, mouse);
				}
			} else {
				if(targetNode == selectedObject) {
					currentLink = new SelfLink(selectedObject, mouse);
				} else if(targetNode !== null) {
					currentLink = new Link(selectedObject, targetNode);
				} else {
					currentLink = new TemporaryLink(selectedObject.closestPointOnCircle(mouse.x, mouse.y), mouse);
				}
			}
			draw();
		} else if(movingObject) {
			selectedObject.setAnchorPoint(mouse.x, mouse.y);
			if(selectedObject instanceof Node) {
				snapNode(selectedObject);
			}
			draw();
		} else if (mouseDown) {
			var newX = mouse.x-originalClick.x;
			var newY = mouse.y-originalClick.y;
			context.translate(newX,newY);
			draw();		
		}

	};

	canvas.onmouseup = function(e) {
		movingObject = false;
		mouseDown = false;

		if(currentLink !== null) {
			if(!(currentLink instanceof TemporaryLink)) {
				selectedObject = currentLink;
				links.push(currentLink);
				resetCaret();
			}
			currentLink = null;
			draw();
		}
	};

	var zoom = function(clicks, mouse){
		context.translate(mouse.x,mouse.y);
		var factor = Math.pow(1.1,clicks);
		context.scale(factor,factor);
		context.translate(-mouse.x,-mouse.y);
		draw();
	};

	var handleScroll = function(e){
		var mouse = crossBrowserMousePos(e);
		var delta = e.wheelDelta ? e.wheelDelta/40 : e.detail ? -e.detail : 0;
		var currentScale = context.getTransform().a;
		if (delta > 0 && currentScale < 5 || delta < 0 && currentScale > 0.2) {
			zoom(delta, mouse);
		}
		return e.preventDefault() && false;
	};
	canvas.addEventListener('DOMMouseScroll',handleScroll,false);
	canvas.addEventListener('mousewheel',handleScroll,false);

	function trackTransforms(context){
		var svg = document.createElementNS("http://www.w3.org/2000/svg",'svg');
		var xform = svg.createSVGMatrix();
		context.getTransform = function(){ return xform; };
		
		var savedTransforms = [];
		var save = context.save;
		context.save = function(){
			savedTransforms.push(xform.translate(0,0));
			return save.call(context);
		};
		var restore = context.restore;
		context.restore = function(){
			xform = savedTransforms.pop();
			return restore.call(context);
		};

		var scale = context.scale;
		context.scale = function(sx,sy){
			xform = xform.scaleNonUniform(sx,sy);
			return scale.call(context,sx,sy);
		};
		var rotate = context.rotate;
		context.rotate = function(radians){
			xform = xform.rotate(radians*180/Math.PI);
			return rotate.call(context,radians);
		};
		var translate = context.translate;
		context.translate = function(dx,dy){
			xform = xform.translate(dx,dy);
			return translate.call(context,dx,dy);
		};
		var transform = context.transform;
		context.transform = function(a,b,c,d,e,f){
			var m2 = svg.createSVGMatrix();
			m2.a=a; m2.b=b; m2.c=c; m2.d=d; m2.e=e; m2.f=f;
			xform = xform.multiply(m2);
			return transform.call(context,a,b,c,d,e,f);
		};
		var setTransform = context.setTransform;
		context.setTransform = function(a,b,c,d,e,f){
			xform.a = a;
			xform.b = b;
			xform.c = c;
			xform.d = d;
			xform.e = e;
			xform.f = f;
			return setTransform.call(context,a,b,c,d,e,f);
		};
		var pt  = svg.createSVGPoint();
		context.transformedPoint = function(x,y){
			pt.x=x; pt.y=y;
			return pt.matrixTransform(xform.inverse());
		};
	}

	var droppables = document.querySelectorAll('.drop'), el = null;
	for (var i = 0; i < droppables.length; i++) {
	    el = droppables[i];
	    el.setAttribute('draggable', 'true');
		el.addEventListener('dragstart', function (e) {
	 		if(currentLink === null) {
	      		e.dataTransfer.effectAllowed = 'copy'; // only dropEffect='copy' will be dropable
	      		e.dataTransfer.setData('Text', this.textContent); // required otherwise doesn't work
	      		return false;
	      	}
	    });
	}

	canvas.addEventListener('dragover', function (e) {
		if(currentLink === null) {
	    	if (e.preventDefault) e.preventDefault(); // allows us to drop
	    	e.dataTransfer.dropEffect = 'copy';
	    }
	    return false;
	});

	canvas.addEventListener('drop', function (e) {
		if(currentLink === null) {
	    	if (e.stopPropagation) e.stopPropagation(); // stops the browser from redirecting...why???
	    	var mouse = crossBrowserMousePos(e);
			var selectedObject = new Node(mouse.x, mouse.y);
			selectedObject.text = e.dataTransfer.getData('Text');
			nodes.push(selectedObject);
			resetCaret();
			draw();
	    }
	    return false;
	});

};

var shift = false;

document.onkeydown = function(e) {
	var key = crossBrowserKey(e);

	if(key == 16) {
		shift = true;
	} else if(!canvasHasFocus()) {
		// don't read keystrokes when other things have focus
		return true;
	} else if(key == 8) { // backspace key
		if(selectedObject !== null && 'text' in selectedObject) {
			selectedObject.text = selectedObject.text.substr(0, selectedObject.text.length - 1);
			resetCaret();
			draw();
		}

		// backspace is a shortcut for the back button, but do NOT want to change pages
		return false;
	} else if(key == 46) { // delete key
		if(selectedObject !== null) {
			for(var i = 0; i < nodes.length; i++) {
				if(nodes[i] == selectedObject) {
					nodes.splice(i--, 1);
				}
			}
			for(var i = 0; i < links.length; i++) {
				if(links[i] == selectedObject || links[i].node == selectedObject || links[i].nodeA == selectedObject || links[i].nodeB == selectedObject) {
					links.splice(i--, 1);
				}
			}
			selectedObject = null;
			draw();
		}
	}
};

document.onkeyup = function(e) {
	var key = crossBrowserKey(e);

	if(key == 16) {
		shift = false;
	}
};

document.onkeypress = function(e) {
	// don't read keystrokes when other things have focus
	var key = crossBrowserKey(e);
	if(!canvasHasFocus()) {
		// don't read keystrokes when other things have focus
		return true;
	} else if(key >= 0x20 && key <= 0x7E && !e.metaKey && !e.altKey && !e.ctrlKey && selectedObject !== null && 'text' in selectedObject) {
		selectedObject.text += String.fromCharCode(key);
		resetCaret();
		draw();

		// don't let keys do their actions (like space scrolls down the page)
		return false;
	} else if(key == 8) {
		// backspace is a shortcut for the back button, but do NOT want to change pages
		return false;
	}
};

function crossBrowserKey(e) {
	e = e || window.event;
	return e.which || e.keyCode;
}

function crossBrowserMousePos(e) {
	var mouseX = e.offsetX || (e.pageX - canvas.offsetLeft);
	var mouseY = e.offsetY || (e.pageY - canvas.offsetTop);
	return context.transformedPoint(mouseX, mouseY);
}

function output(text) {
	var element = document.getElementById('output');
	element.style.display = 'block';
	element.value = text;
}

function saveAsPNG() {
	var oldSelectedObject = selectedObject;
	selectedObject = null;
	drawUsing(context);
	selectedObject = oldSelectedObject;
	var pngData = canvas.toDataURL('image/png');
	document.location.href = pngData;
}

function saveAsSVG() {
	var exporter = new ExportAsSVG();
	var oldSelectedObject = selectedObject;
	selectedObject = null;
	drawUsing(exporter);
	selectedObject = oldSelectedObject;
	var svgData = exporter.toSVG();
	output(svgData);
	// Chrome isn't ready for this yet, the 'Save As' menu item is disabled
	// document.location.href = 'data:image/svg+xml;base64,' + btoa(svgData);
}

function saveAsLaTeX() {
	var exporter = new ExportAsLaTeX();
	var oldSelectedObject = selectedObject;
	selectedObject = null;
	drawUsing(exporter);
	selectedObject = oldSelectedObject;
	var texData = exporter.toLaTeX();
	output(texData);
}
