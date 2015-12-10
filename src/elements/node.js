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