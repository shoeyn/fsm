function det(a, b, c, d, e, f, g, h, i) {
	return a*e*i + b*f*g + c*d*h - a*f*h - b*d*i - c*e*g;
}

function circleFromThreePoints(x1, y1, x2, y2, x3, y3) {
	var a = det(x1, y1, 1, x2, y2, 1, x3, y3, 1);
	var bx = -det(x1*x1 + y1*y1, y1, 1, x2*x2 + y2*y2, y2, 1, x3*x3 + y3*y3, y3, 1);
	var by = det(x1*x1 + y1*y1, x1, 1, x2*x2 + y2*y2, x2, 1, x3*x3 + y3*y3, x3, 1);
	var c = -det(x1*x1 + y1*y1, x1, y1, x2*x2 + y2*y2, x2, y2, x3*x3 + y3*y3, x3, y3);
	return {
		'x': -bx / (2*a),
		'y': -by / (2*a),
		'radius': Math.sqrt(bx*bx + by*by - 4*a*c) / (2*Math.abs(a))
	};
}

function fixed(number, digits) {
	return number.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
}

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

function drawText(c, originalText, x, y, angleOrNull, isSelected, boxObject) {
	// draw text and caret (round the coordinates so the caret falls on a pixel)
	text = convertLatexShortcuts(originalText);
	c.font = '20px sans-serif';
	var width = c.measureText(text).width;

	if('advancedFillText' in c) {
		c.advancedFillText(text, originalText, x + width / 2, y, angleOrNull);
	}
	if (typeof boxObject.width != 'undefined') {
		var words = text.split(' ');
        var line = '';
        var lineHeight = 24;

        for(var n = 0; n < words.length; n++) {
          var testLine = line + words[n] + ' ';
          var metrics = c.measureText(testLine);
          var testWidth = metrics.width;
          if (testWidth > boxObject.width && n > 0) {
            c.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
          }
          else {
            line = testLine;
          }
        }
        c.fillText(line, x, y);
    } else {
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
var resizingObject = false;
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
	context.setTransform(1, 0, 0, 1, canvas.width*0.5, canvas.height*0.5);
	draw();
	var inp = document.getElementById('liveChange');
	var origin = document.getElementById('origin');

	inp.oninput = function(e) {
		if(selectedObject !== null) {
			selectedObject.text = inp.value;
			draw();
		}
	};
	origin.onclick = function(e) {
		var currentScale = context.getTransform().a;
		context.setTransform(currentScale, 0, 0, currentScale, canvas.width*0.5, canvas.height*0.5);
		draw();
	};

	canvas.onmousedown = function(e) {
		var mouse = crossBrowserMousePos(e);
		selectedObject = selectObject(mouse.x, mouse.y);
		movingObject = false;
		originalClick = mouse;

		if(selectedObject !== null) {
			if (selectedObject instanceof Node) {
				if(shift)  {
					currentLink = new TemporaryLink(mouse, mouse);
				} else {
					selectedObject.setMouseStart(mouse.x, mouse.y);
					deltaMouseX = deltaMouseY = 0;
					if (selectedObject.isResizing()) {
						resizingObject = true;
					} else {
						movingObject = true;
						inp.value = selectedObject.text;
					}
				}
			}
			resetCaret();
		} else {
			inp.value = "";
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
		} else if (selectedObject instanceof Link) {
			var tmp = selectedObject.nodeA;
			selectedObject.nodeA = selectedObject.nodeB;
			selectedObject.nodeB = tmp;
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

			if(selectedObject !== null) {
				if(targetNode !== null) {
					if (targetNode != selectedObject) {
						currentLink = new Link(selectedObject, targetNode);
					}
				} else {
					currentLink = new TemporaryLink(selectedObject.closestPoint(mouse.x, mouse.y), mouse);
				}
			}
			draw();
		} else if(movingObject) {
			selectedObject.setAnchorPoint(mouse.x, mouse.y);
			if(selectedObject instanceof Node) {
				snapNode(selectedObject);
			}
			draw();
		} else if (resizingObject) {
			selectedObject.resizeObject(mouse.x, mouse.y);
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
		resizingObject = false;
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
		if (delta > 0 && currentScale < 4 || delta < 0 && currentScale > 0.2) {
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
	      		e.dataTransfer.setData('Type', this.textContent); // required otherwise doesn't work
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
			var tmp = e.dataTransfer.getData('Type');
			selectedObject.text = tmp;
			if (tmp == "Answer") {
				selectedObject.isAcceptState = true;
			}
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
	document.location.href = 'data:image/svg+xml;base64,' + btoa(svgData);
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

function restoreBackup() {
	if(!localStorage || !JSON) {
		return;
	}

	try {
		var backup = JSON.parse(localStorage['fsm']);

		for(var i = 0; i < backup.nodes.length; i++) {
			var backupNode = backup.nodes[i];
			var node = new Node(backupNode.x, backupNode.y);
			node.isAcceptState = backupNode.isAcceptState;
			node.text = backupNode.text;
			node.width = backupNode.width;
			node.height = backupNode.height;
			nodes.push(node);
		}
		for(var i = 0; i < backup.links.length; i++) {
			var backupLink = backup.links[i];
			var link = null;
			if(backupLink.type == 'Link') {
				link = new Link(nodes[backupLink.nodeA], nodes[backupLink.nodeB]);
				link.parallelPart = backupLink.parallelPart;
				link.perpendicularPart = backupLink.perpendicularPart;
				link.text = backupLink.text;
				link.lineAngleAdjust = backupLink.lineAngleAdjust;
			}
			if(link !== null) {
				links.push(link);
			}
		}
	} catch(e) {
		localStorage['fsm'] = '';
	}
}

function saveBackup() {
	if(!localStorage || !JSON) {
		return;
	}

	var backup = {
		'nodes': [],
		'links': [],
	};
	for(var i = 0; i < nodes.length; i++) {
		var node = nodes[i];
		var backupNode = {
			'x': node.x,
			'y': node.y,
			'text': node.text,
			'width': node.width,
			'height': node.height,
			'isAcceptState': node.isAcceptState,
		};
		backup.nodes.push(backupNode);
	}
	for(var i = 0; i < links.length; i++) {
		var link = links[i];
		var backupLink = null;
		if(link instanceof Link) {
			backupLink = {
				'type': 'Link',
				'nodeA': nodes.indexOf(link.nodeA),
				'nodeB': nodes.indexOf(link.nodeB),
				'text': link.text,
				'lineAngleAdjust': link.lineAngleAdjust,
				'parallelPart': link.parallelPart,
				'perpendicularPart': link.perpendicularPart,
			};
		}
		if(backupLink !== null) {
			backup.links.push(backupLink);
		}
	}

	localStorage['fsm'] = JSON.stringify(backup);
}

function Link(a, b) {
	this.nodeA = a;
	this.nodeB = b;
	this.text = '';
	this.lineAngleAdjust = 0; // value to add to textAngle when link is straight line

	// make anchor point relative to the locations of nodeA and nodeB
	this.parallelPart = 0.5; // percentage from nodeA to nodeB
	this.perpendicularPart = 0; // pixels from line between nodeA and nodeB
}

Link.prototype.getAnchorPoint = function() {
	var dx = this.nodeB.x - this.nodeA.x;
	var dy = this.nodeB.y - this.nodeA.y;
	var scale = Math.sqrt(dx * dx + dy * dy);
	return {
		'x': this.nodeA.x + dx * this.parallelPart - dy * this.perpendicularPart / scale,
		'y': this.nodeA.y + dy * this.parallelPart + dx * this.perpendicularPart / scale
	};
};

Link.prototype.setAnchorPoint = function(x, y) {
	var dx = this.nodeB.x - this.nodeA.x;
	var dy = this.nodeB.y - this.nodeA.y;
	var scale = Math.sqrt(dx * dx + dy * dy);
	this.parallelPart = (dx * (x - this.nodeA.x) + dy * (y - this.nodeA.y)) / (scale * scale);
	this.perpendicularPart = (dx * (y - this.nodeA.y) - dy * (x - this.nodeA.x)) / scale;
	// snap to a straight line
	if(this.parallelPart > 0 && this.parallelPart < 1 && Math.abs(this.perpendicularPart) < snapToPadding) {
		this.lineAngleAdjust = (this.perpendicularPart < 0) * Math.PI;
		this.perpendicularPart = 0;
	}
};

Link.prototype.getEndPointsAndCircle = function() {
	var midX = (this.nodeA.x + this.nodeB.x) / 2;
	var midY = (this.nodeA.y + this.nodeB.y) / 2;
	var start = this.nodeA.closestPoint(midX, midY);
	var end = this.nodeB.closestPoint(midX, midY);
	return {
		'hasCircle': false,
		'startX': start.x,
		'startY': start.y,
		'endX': end.x,
		'endY': end.y,
	};
};

Link.prototype.draw = function(c) {
	var stuff = this.getEndPointsAndCircle();
	// draw arc
	c.beginPath();
	c.moveTo(stuff.startX, stuff.startY);
	c.lineTo(stuff.endX, stuff.endY);
	c.stroke();
	// draw the head of the arrow
	drawArrow(c, stuff.endX, stuff.endY, Math.atan2(stuff.endY - stuff.startY, stuff.endX - stuff.startX));
	// draw the text
	var textX = (stuff.startX + stuff.endX) / 2;
	var textY = (stuff.startY + stuff.endY) / 2;
	var textAngle = Math.atan2(stuff.endX - stuff.startX, stuff.startY - stuff.endY);
	drawText(c, this.text, textX, textY, textAngle + this.lineAngleAdjust, selectedObject == this, this);
};

Link.prototype.containsPoint = function(x, y) {
	var stuff = this.getEndPointsAndCircle();
	var dx = stuff.endX - stuff.startX;
	var dy = stuff.endY - stuff.startY;
	var length = Math.sqrt(dx*dx + dy*dy);
	var percent = (dx * (x - stuff.startX) + dy * (y - stuff.startY)) / (length * length);
	var distance = (dx * (y - stuff.startY) - dy * (x - stuff.startX)) / length;
	return (percent > 0 && percent < 1 && Math.abs(distance) < hitTargetPadding);
};

function TemporaryLink(from, to) {
	this.from = from;
	this.to = to;
}

TemporaryLink.prototype.draw = function(c) {
	// draw the line
	c.beginPath();
	c.moveTo(this.to.x, this.to.y);
	c.lineTo(this.from.x, this.from.y);
	c.stroke();

	// draw the head of the arrow
	drawArrow(c, this.to.x, this.to.y, Math.atan2(this.to.y - this.from.y, this.to.x - this.from.x));
};

function Node(x, y) {
	this.x = x;
	this.y = y;
	this.mouseOffsetX = 0;
	this.mouseOffsetY = 0;
	this.isAcceptState = false;
	this.text = '';
	this.width = 200;
	this.height = 50;
	this.origW = 200;
	this.origH = 50;
}

Node.prototype.setMouseStart = function(x, y) {
	this.mouseOffsetX = this.x - x;
	this.mouseOffsetY = this.y - y;
};

Node.prototype.isResizing = function() {
	if (-this.mouseOffsetX < this.width/2 &&
		-this.mouseOffsetX > this.width/2 - 10 &&
		-this.mouseOffsetY < this.height/2 &&
		-this.mouseOffsetY > this.height/2 - 10) {
		this.origW = this.width;
		this.origH = this.height;
		return true;
	} else {
		return false;
	}
};
Node.prototype.resizeObject = function(x, y) {
	var adjustX = (x + this.origW/2 + this.mouseOffsetX - this.x) * 2;
	var adjustY = (y + this.origH/2 + this.mouseOffsetY - this.y) * 2;
	if (adjustX > 200) {
		this.width = adjustX;
	}
	if (adjustY > 50) {
		this.height = adjustY;
	}
};

Node.prototype.setAnchorPoint = function(x, y) {
	this.x = x + this.mouseOffsetX;
	this.y = y + this.mouseOffsetY;
};

Node.prototype.draw = function(c) {
	var stroke = true;
	var radius = {tl: 5, tr: 5, br: 5, bl: 5};
	var tmpX = this.x - this.width/2;
	var tmpY = this.y - this.height/2;
	c.beginPath();
	c.moveTo(tmpX + radius.tl, tmpY);
	c.lineTo(tmpX + this.width - radius.tr, tmpY);
	c.quadraticCurveTo(tmpX + this.width, tmpY, tmpX + this.width, tmpY + radius.tr);
	c.lineTo(tmpX + this.width, tmpY + this.height - radius.br);
	c.quadraticCurveTo(tmpX + this.width, tmpY + this.height, tmpX + this.width - radius.br, tmpY + this.height);
	c.lineTo(tmpX + radius.bl, tmpY + this.height);
	c.quadraticCurveTo(tmpX, tmpY + this.height, tmpX, tmpY + this.height - radius.bl);
	c.lineTo(tmpX, tmpY + radius.tl);
	c.quadraticCurveTo(tmpX, tmpY, tmpX + radius.tl, tmpY);
	if (this.isAcceptState) {
		c.fillStyle = '#f00';
		c.fill();
	}
	c.fillStyle = '#000';
	c.closePath();
	c.stroke();
	c.beginPath();
	tmpX = this.x + this.width/2 - 10;
	tmpY = this.y + this.height/2 - 10;
	c.moveTo(tmpX, tmpY);
	c.lineTo(tmpX + 6, tmpY + 6);
	c.lineTo(tmpX + 2, tmpY + 6);
	c.moveTo(tmpX + 6, tmpY + 6);
	c.lineTo(tmpX + 6, tmpY + 2);
	c.closePath();
	c.stroke();
	drawText(c, this.text, this.x-this.width/2+10, this.y-this.height/2+20, null, selectedObject == this, this);
};

Node.prototype.closestPoint = function(x, y) {
	var dx = x - this.x;
	var dy = y - this.y;
	var newX, newY;
	var boxA = Math.atan(this.height/this.width);
	var mouseA = Math.atan(Math.abs(dy)/Math.abs(dx));
	if (mouseA > boxA) {
		newX = this.x;
		if (dy > 0) {
			newY = this.y + this.height/2;
		} else {
			newY = this.y - this.height/2;
		}
	} else {
		newY = this.y;
		if (dx >= 0) {
			newX = this.x + this.width/2;
		} else {
			newX = this.x - this.width/2;
		}
	}
	return {
		'x': newX,
		'y': newY
	};
};

Node.prototype.containsPoint = function(x, y) {
	return Math.abs(x - this.x) < this.width/2 && Math.abs(y - this.y) < this.height/2;
};
// draw using this instead of a canvas and call toLaTeX() afterward
function ExportAsLaTeX() {
	this._points = [];
	this._texData = '';
	this._scale = 0.1; // to convert pixels to document space (TikZ breaks if the numbers get too big, above 500?)

	this.toLaTeX = function() {
		return '\\documentclass[12pt]{article}\n' +
			'\\usepackage{tikz}\n' +
			'\n' +
			'\\begin{document}\n' +
			'\n' +
			'\\begin{center}\n' +
			'\\begin{tikzpicture}[scale=0.2]\n' +
			'\\tikzstyle{every node}+=[inner sep=0pt]\n' +
			this._texData +
			'\\end{tikzpicture}\n' +
			'\\end{center}\n' +
			'\n' +
			'\\end{document}\n';
	};

	this.beginPath = function() {
		this._points = [];
	};
	this.arc = function(x, y, radius, startAngle, endAngle, isReversed) {
		x *= this._scale;
		y *= this._scale;
		radius *= this._scale;
		if(endAngle - startAngle == Math.PI * 2) {
			this._texData += '\\draw [' + this.strokeStyle + '] (' + fixed(x, 3) + ',' + fixed(-y, 3) + ') circle (' + fixed(radius, 3) + ');\n';
		} else {
			if(isReversed) {
				var temp = startAngle;
				startAngle = endAngle;
				endAngle = temp;
			}
			if(endAngle < startAngle) {
				endAngle += Math.PI * 2;
			}
			// TikZ needs the angles to be in between -2pi and 2pi or it breaks
			if(Math.min(startAngle, endAngle) < -2*Math.PI) {
				startAngle += 2*Math.PI;
				endAngle += 2*Math.PI;
			} else if(Math.max(startAngle, endAngle) > 2*Math.PI) {
				startAngle -= 2*Math.PI;
				endAngle -= 2*Math.PI;
			}
			startAngle = -startAngle;
			endAngle = -endAngle;
			this._texData += '\\draw [' + this.strokeStyle + '] (' + fixed(x + radius * Math.cos(startAngle), 3) + ',' + fixed(-y + radius * Math.sin(startAngle), 3) + ') arc (' + fixed(startAngle * 180 / Math.PI, 5) + ':' + fixed(endAngle * 180 / Math.PI, 5) + ':' + fixed(radius, 3) + ');\n';
		}
	};
	this.moveTo = this.lineTo = function(x, y) {
		x *= this._scale;
		y *= this._scale;
		this._points.push({ 'x': x, 'y': y });
	};
	this.stroke = function() {
		if(this._points.length == 0) return;
		this._texData += '\\draw [' + this.strokeStyle + ']';
		for(var i = 0; i < this._points.length; i++) {
			var p = this._points[i];
			this._texData += (i > 0 ? ' --' : '') + ' (' + fixed(p.x, 2) + ',' + fixed(-p.y, 2) + ')';
		}
		this._texData += ';\n';
	};
	this.fill = function() {
		if(this._points.length == 0) return;
		this._texData += '\\fill [' + this.strokeStyle + ']';
		for(var i = 0; i < this._points.length; i++) {
			var p = this._points[i];
			this._texData += (i > 0 ? ' --' : '') + ' (' + fixed(p.x, 2) + ',' + fixed(-p.y, 2) + ')';
		}
		this._texData += ';\n';
	};
	this.measureText = function(text) {
		var c = canvas.getContext('2d');
		c.font = '20px "Times New Romain", serif';
		return c.measureText(text);
	};
	this.advancedFillText = function(text, originalText, x, y, angleOrNull) {
		if(text.replace(' ', '').length > 0) {
			var nodeParams = '';
			// x and y start off as the center of the text, but will be moved to one side of the box when angleOrNull != null
			if(angleOrNull != null) {
				var width = this.measureText(text).width;
				var dx = Math.cos(angleOrNull);
				var dy = Math.sin(angleOrNull);
				if(Math.abs(dx) > Math.abs(dy)) {
					if(dx > 0) nodeParams = '[right] ', x -= width / 2;
					else nodeParams = '[left] ', x += width / 2;
				} else {
					if(dy > 0) nodeParams = '[below] ', y -= 10;
					else nodeParams = '[above] ', y += 10;
				}
			}
			x *= this._scale;
			y *= this._scale;
			this._texData += '\\draw (' + fixed(x, 2) + ',' + fixed(-y, 2) + ') node ' + nodeParams + '{$' + originalText.replace(/ /g, '\\mbox{ }') + '$};\n';
		}
	};

	this.translate = this.save = this.restore = this.clearRect = function(){};
}

// draw using this instead of a canvas and call toSVG() afterward
function ExportAsSVG() {
	this.fillStyle = 'black';
	this.strokeStyle = 'black';
	this.lineWidth = 1;
	this.font = '12px Arial, sans-serif';
	this._points = [];
	this._svgData = '';
	this._transX = 0;
	this._transY = 0;

	this.toSVG = function() {
		return '<?xml version="1.0" standalone="no"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n\n<svg width="800" height="600" version="1.1" xmlns="http://www.w3.org/2000/svg">\n' + this._svgData + '</svg>\n';
	};

	this.beginPath = function() {
		this._points = [];
	};
	this.arc = function(x, y, radius, startAngle, endAngle, isReversed) {
		x += this._transX;
		y += this._transY;
		var style = 'stroke="' + this.strokeStyle + '" stroke-width="' + this.lineWidth + '" fill="none"';

		if(endAngle - startAngle == Math.PI * 2) {
			this._svgData += '\t<ellipse ' + style + ' cx="' + fixed(x, 3) + '" cy="' + fixed(y, 3) + '" rx="' + fixed(radius, 3) + '" ry="' + fixed(radius, 3) + '"/>\n';
		} else {
			if(isReversed) {
				var temp = startAngle;
				startAngle = endAngle;
				endAngle = temp;
			}

			if(endAngle < startAngle) {
				endAngle += Math.PI * 2;
			}

			var startX = x + radius * Math.cos(startAngle);
			var startY = y + radius * Math.sin(startAngle);
			var endX = x + radius * Math.cos(endAngle);
			var endY = y + radius * Math.sin(endAngle);
			var useGreaterThan180 = (Math.abs(endAngle - startAngle) > Math.PI);
			var goInPositiveDirection = 1;

			this._svgData += '\t<path ' + style + ' d="';
			this._svgData += 'M ' + fixed(startX, 3) + ',' + fixed(startY, 3) + ' '; // startPoint(startX, startY)
			this._svgData += 'A ' + fixed(radius, 3) + ',' + fixed(radius, 3) + ' '; // radii(radius, radius)
			this._svgData += '0 '; // value of 0 means perfect circle, others mean ellipse
			this._svgData += +useGreaterThan180 + ' ';
			this._svgData += +goInPositiveDirection + ' ';
			this._svgData += fixed(endX, 3) + ',' + fixed(endY, 3); // endPoint(endX, endY)
			this._svgData += '"/>\n';
		}
	};
	this.moveTo = this.lineTo = function(x, y) {
		x += this._transX;
		y += this._transY;
		this._points.push({ 'x': x, 'y': y });
	};
	this.stroke = function() {
		if(this._points.length == 0) return;
		this._svgData += '\t<polygon stroke="' + this.strokeStyle + '" stroke-width="' + this.lineWidth + '" points="';
		for(var i = 0; i < this._points.length; i++) {
			this._svgData += (i > 0 ? ' ' : '') + fixed(this._points[i].x, 3) + ',' + fixed(this._points[i].y, 3);
		}
		this._svgData += '"/>\n';
	};
	this.fill = function() {
		if(this._points.length == 0) return;
		this._svgData += '\t<polygon fill="' + this.fillStyle + '" stroke-width="' + this.lineWidth + '" points="';
		for(var i = 0; i < this._points.length; i++) {
			this._svgData += (i > 0 ? ' ' : '') + fixed(this._points[i].x, 3) + ',' + fixed(this._points[i].y, 3);
		}
		this._svgData += '"/>\n';
	};
	this.measureText = function(text) {
		var c = canvas.getContext('2d');
		c.font = '20px "Times New Romain", serif';
		return c.measureText(text);
	};
	this.fillText = function(text, x, y) {
		x += this._transX;
		y += this._transY;
		if(text.replace(' ', '').length > 0) {
			this._svgData += '\t<text x="' + fixed(x, 3) + '" y="' + fixed(y, 3) + '" font-family="Times New Roman" font-size="20">' + textToXML(text) + '</text>\n';
		}
	};
	this.translate = function(x, y) {
		this._transX = x;
		this._transY = y;
	};

	this.save = this.restore = this.clearRect = function(){};
}
