function Node(x, y) {
	this.x = x;
	this.y = y;
	this.mouseOffsetX = 0;
	this.mouseOffsetY = 0;
	this.isAcceptState = false;
	this.text = '';
}

Node.prototype.setMouseStart = function(x, y) {
	this.mouseOffsetX = this.x - x;
	this.mouseOffsetY = this.y - y;
};

Node.prototype.setAnchorPoint = function(x, y) {
	this.x = x + this.mouseOffsetX;
	this.y = y + this.mouseOffsetY;
};


Node.prototype.draw = function(c) {
	// draw the circle
	c.beginPath();
	c.arc(this.x, this.y, nodeRadius, 0, 2 * Math.PI, false);
	c.stroke();

	// draw the text
	drawText(c, this.text, this.x, this.y, null, selectedObject == this);

	// draw a double circle for an accept state
	if(this.isAcceptState) {
		c.beginPath();
		c.arc(this.x, this.y, nodeRadius - 6, 0, 2 * Math.PI, false);
		c.stroke();
	}
};


/*
Node.prototype.draw = function(c) {
	var stroke = true;
	var radius = {tl: 5, tr: 5, br: 5, bl: 5};
	var width = 200;
	var height = 50;
	c.beginPath();
	c.moveTo(this.x + radius.tl, this.y);
	c.lineTo(this.x + width - radius.tr, this.y);
	c.quadraticCurveTo(this.x + width, this.y, this.x + width, this.y + radius.tr);
	c.lineTo(this.x + width, this.y + height - radius.br);
	c.quadraticCurveTo(this.x + width, this.y + height, this.x + width - radius.br, this.y + height);
	c.lineTo(this.x + radius.bl, this.y + height);
	c.quadraticCurveTo(this.x, this.y + height, this.x, this.y + height - radius.bl);
	c.lineTo(this.x, this.y + radius.tl);
	c.quadraticCurveTo(this.x, this.y, this.x + radius.tl, this.y);
	c.closePath();
	c.stroke();
	drawText(c, this.text, this.x, this.y, null, selectedObject == this);
};
*/

Node.prototype.closestPointOnCircle = function(x, y) {
	var dx = x - this.x;
	var dy = y - this.y;
	var scale = Math.sqrt(dx * dx + dy * dy);
	return {
		'x': this.x + dx * nodeRadius / scale,
		'y': this.y + dy * nodeRadius / scale,
	};
};

Node.prototype.containsPoint = function(x, y) {
	return (x - this.x)*(x - this.x) + (y - this.y)*(y - this.y) < nodeRadius*nodeRadius;
};
