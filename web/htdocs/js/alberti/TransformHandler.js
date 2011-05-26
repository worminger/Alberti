/*
 * TransformHandler.js
 * extends EventHandler
 * 
 * Event handler that provides both local (window/client) mouse coordinates 
 * and global (workspace) mouse coordinates, as well as snap-to-intersection
 * features with the help of the layer manager.
 * 
 * USAGE
 * 
 * Inheriting classes must pass the master group, the layer manager, and the 
 * overlay group. Instead of implementing typical mouse event methods 
 * (mouseup, mousedown, etc.), inheriting classes should override any or all 
 * of the following:
 * 
 *    onMouseUp(gx, gy, evt)
 *    onMouseDown(gx, gy, evt)
 *    onMouseMove(gx, gy, evt)
 * 
 * Where "gx" and "gy" represent global coordinates. For local coordinates,
 * inheriting classes can simply query the evt object (e.g. evt.clientX). 
 * Other mouse events are not yet supported.
 * 
 * Call TransformHandler::enableSnapping or TransformHandler::disableSnapping 
 * to enable/disable auto-snapping.
 * 
 * If auto-snapping is enabled, TransformHandler will query the layer manager
 * for snap points and attempt to "snap" mouse event coordinates to nearby 
 * snap points before sending them to inheriting classes' event handling 
 * methods.
 * 
 * Other methods
 * 
 * You may call TransformHandler::getLastMousePosition to retrieve the last
 * mouse coordinate generated by a mousemove event. This returns a Coord2D 
 * with null x and y properties if no mousemove events occurred since the 
 * TransformHandler's instantiation.
 * 
 * Similarly, you may call TransformHandler::getCurrentSnapPoint to retrieve 
 * the current snap point. This returns null if the mouse is not currently
 * "snapping" to any point.
 * 
 * * */

// Limit how often the snap coordinate is recalculated
TransformHandler.snapRecalcFreq = Math.min(20, Alberti.fpsMax);
TransformHandler.recalcms =  Math.round(1000 / TransformHandler.snapRecalcFreq);
 
function TransformHandler(masterGroup, layerManager, overlayGroup) {
	TransformHandler.baseConstructor.call(this);
	this.masterGroup = masterGroup;
	this.layerManager = layerManager;
	this.overlayGroup = overlayGroup;
	
	this.currentSnapPoint = null;
	this.lastSnapUpdate = 0;
	this.snappingEnabled = false;
	this.snapGuide = null;
	
	this.lastMouseX = null;
	this.lastMouseY = null;
}
Util.extend(TransformHandler, EventHandler);

TransformHandler.prototype.getLastMousePosition = function() {
	return new Coord2D(this.lastMouseX, this.lastMouseY);
};

// Returns the last coordinate the mouse was "snapped" to, or null if there
// was no nearby intersection.
TransformHandler.prototype.getCurrentSnapPoint = function() {
	return this.currentSnapPoint ? this.currentSnapPoint.clone() : null;
};

TransformHandler.prototype.localToGlobal = function(lx, ly) {
	return new Coord2D((lx - Alberti.halfOriginalWindowWidth - this.masterGroup.position.x) / this.masterGroup.scale,
		(ly - Alberti.halfOriginalWindowHeight - this.masterGroup.position.y) / this.masterGroup.scale);
};

// Sets coord to nearest intersection and displays/hides snap guide. Note that
// in order to save CPU cycles, the nearest intersection is only recalculated
// every so often.
TransformHandler.prototype.snap = function(coord) {
	if (this.snappingEnabled && coord.x !== null) {
		if (Date.now() - this.lastSnapUpdate >= TransformHandler.recalcms) {
			this.lastSnapUpdate = Date.now();
		
			// Query the layer manager's Intersection object for nearby intersection points
			var newCoord = this.layerManager.intersections.getNearbyIntersection(coord);
			this.currentSnapPoint = newCoord;
	
			if (newCoord) {
				// There is a nearby intersection. Display the snap guide.
				coord.x = newCoord.x;
				coord.y = newCoord.y;
		
				if (!this.snapGuide) {
					this.snapGuide = new Point().generate();
					this.snapGuide.innerColor = "none";
					this.snapGuide.set("opacity", "0.65");
					this.overlayGroup.attachChild(this.snapGuide);
				}
		
				this.snapGuide.coord.x = coord.x;
				this.snapGuide.coord.y = coord.y;
				this.snapGuide.push();
			} else if (this.snapGuide) {
				// There is no nearby intersection. Remove the snap guide.
				this.snapGuide.detach();
				this.snapGuide = null;
			}
		} else {
			if (this.currentSnapPoint) {
				coord.x = this.currentSnapPoint.x;
				coord.y = this.currentSnapPoint.y;
			}
		}
	}
};

TransformHandler.prototype.enableSnapping = function() {
	if (!this.snappingEnabled) {
		this.snappingEnabled = true;
	
		// Spoof a mousemove so inheriting classes update to new snap point
		var p = new Coord2D(this.lastMouseX, this.lastMouseY);
		this.snap(p);
		this.onMouseMove(p.x, p.y);
	}
};

TransformHandler.prototype.disableSnapping = function() {
	if (this.snappingEnabled) {
		this.snappingEnabled = false;
		
		if (this.snapGuide) {
			this.snapGuide.detach();
			this.snapGuide = null;
			this.currentSnapPoint = null;
		}
		
		// Spoof a mousemove so inheriting classes update to new snap point
		var p = new Coord2D(this.lastMouseX, this.lastMouseY);
		this.snap(p);
		this.onMouseMove(p.x, p.y);
	}
};

TransformHandler.prototype.mousedown = function(evt) {
	var p = this.localToGlobal(evt.clientX, evt.clientY);
	
	// If no mousemoves have occurred since the instantiation of this
	// TransformHandler, set the last mouse position to this click position.
	if (this.lastMouseX === null) {
		this.lastMouseX = p.x;
		this.lastMouseY = p.y;
	}
	
	this.snap(p);
	this.onMouseDown(p.x, p.y, evt);
};

TransformHandler.prototype.mouseup = function(evt) {
	var p = this.localToGlobal(evt.clientX, evt.clientY);
	this.snap(p);
	this.onMouseUp(p.x, p.y, evt);
};

TransformHandler.prototype.mousemove = function(evt) {
	var p = this.localToGlobal(evt.clientX, evt.clientY);
	
	this.lastMouseX = p.x;
	this.lastMouseY = p.y;
	
	this.snap(p);
	this.onMouseMove(p.x, p.y, evt);
};

/* * * * * * * * * * * * Abstract methods below * * * * * * * * * * * * * * */

TransformHandler.prototype.onMouseDown = function(gx, gy, evt) {};

TransformHandler.prototype.onMouseUp = function(gx, gy, evt) {};

TransformHandler.prototype.onMouseMove = function(gx, gy, evt) {};