/*
 * Tool.js
 * extends TransformHandler
 * 
 * Every Tool creates a shape (or multiple shapes) through a series of steps, 
 * each one involving a mouse click. The number of steps, and exactly how 
 * those clicks are interpreted  depends on the type of tool. For instance, a 
 * point tool might involve a single step: click to create a new point. A 
 * circle tool might involve two steps: (1) click to place the circle's 
 * center, (2) click to set the circle's radius.
 * 
 * At any point, the user may revert to a previous step, or cancel the 
 * operation altogether if it is already on the first step, by hitting the 
 * escape key. Some tools have optional steps, and may be short-circuited via 
 * the enter or return keys.
 * 
 * Some tools might allow the user to "constrain" the mouse (e.g. a line tool
 * that allows constraining to horizontal or vertical). All constraining 
 * is performed with the shift key.
 * 
 * NOTES
 * 
 * Tool captures mousedowns at the window level while enabled.
 * 
 * USAGE
 * 
 * The numSteps parameter of the Tool constructor represents the maximum
 * number of steps required to perform a complete operation with the tool.
 * Likewise, minSteps represents the minimum number of steps before the user
 * can short-circuit the operation of the tool with the enter key. Pass -1 for
 * numSteps to create an unbounded tool (e.g. a path tool might allow any
 * number of points to be added to the path). The final parameter of is a
 * boolean flag indicating whether or not mouseup events should execute a
 * step (in other words, if it is true, the user must hold the mouse down in 
 * order to suppress execution of the next step; defaults to false). Classes 
 * must implement the following methods:
 * 
 * executeStep(stepNum, gx, gy)
 * 
 * This method is invoked every time a new step has been initiated by the user
 * clicking in the workspace, starting with step 0. It is also invoked in 
 * order to restore a step to original state when the user reverts to a 
 * previous step with the 'escape' key. Parameters include the step number 
 * being executed, the global coordinates <gx,gy> of the click (referred to as 
 * the "key coordinate" of the step), and the event object generated by the 
 * click. Execution of a step typically involves adding interactive shapes to 
 * the workspace (such as a line for a line tool).
 * 
 * These shapes are added with the Tool::registerShape method, which takes up 
 * to four arguments: a Shape object, a name by which to refer to the 
 * Shape in future steps via Tool::getShape, and an optional flag indicating
 * whether to draw the shape in the underlay or overlay.
 * 
 * In many cases you will use Tool::getShape to query the properties of a
 * previously registered shape, and use those properties to determine how to
 * draw new shapes in the current step. However, if one of those shapes is 
 * updated dynamically (e.g. an interactive shape that follows the mouse), you 
 * will lose the data describing its original state. In that case, 
 * Tool::getKeyCoordFromStep is an essential method as it allows you to query
 * the position of the mouseclick that originally triggered that step.
 * 
 * Previously registered shapes may be unregistered at any time with the
 * Tool::unregisterShape method.
 * 
 * Shapes that were registered with the underlay flag set to false can later 
 * be moved to the underlay via Tool::sendShapeToUnderlay. The opposite can be
 * done with Tool::sendShapeToOverlay.
 * 
 * You can indicate whether a shape should be "baked" (explained below under
 * the Tool::complete section) by calling Tool::bakeShape with the name of the
 * shape to be baked.
 * 
 * mouseMoveDuringStep(stepNum, gx, gy, constrain)
 * 
 * This method is invoked every time a mousemove event occurs and hence will
 * be used to implement the interactivity of the tool. Taking the example of
 * the line tool, you would update a previously registered line shape to match 
 * the new mouse position. Some tools will need to constrain mouse 
 * coordinates based on whether the shift key is down. If the constrain
 * parameter is true, constraining should take place.
 * 
 * The Tool::setConstrainCoords method is also essential for tools that must
 * constrain the mouse. This method locks Tool's internal mouse coordinates to 
 * the constrained position. This way, the locked mouse coordinates will be 
 * passed to the next executeStep invocation, rather than the unconstrained 
 * coordinates of the click.
 * 
 * You may display tool tips by calling Tool::displayTip, which expects the
 * same arguments as ToolTip::setText.
 * 
 * complete(stepNum, constrain)
 * 
 * This method is called upon completion of the tool, either by reaching the
 * final step, or by the user short-circuiting the tool with the enter key.
 * In the first case, stepNum will be equivalent to the tool's final step. In 
 * the second case, stepNum indicates the step during which the short-circuit 
 * occurred. 'constrain' is true if the shift-key was down at the time, false
 * otherwise.
 * 
 * If you did not mark any shapes for baking while executing a prior step, you 
 * can mark them here.
 * 
 * After calling the inheriting class' complete() method, any shapes that were
 * marked for baking with Tool::bakeShape will be transferred to the current
 * layer of the workspace. All other shapes will be deleted automatically.
 * 
 * onDeactivate()
 * 
 * This method may be overridden optionally. It is invoked when the tool is
 * deactivated (i.e. the user has selected a different tool).
 * 
 * * */
 
function Tool(masterGroup, layerManager, undoManager, overlayGroup, underlayGroup, toolTip, numSteps, minSteps, mouseupFlag) {
	Tool.baseConstructor.call(this, masterGroup, layerManager, overlayGroup);
	this.undoManager =  undoManager;
	this.underlayGroup = underlayGroup;
	this.toolTip = toolTip;
	
	this.numSteps = numSteps;
	this.minSteps = arguments.length > 4 ? minSteps : numSteps;
	this.steps = [];
	this.currentStep = -1;
	
	this.mouseupFlag = arguments.length > 7 ? mouseupFlag : false;
	
	this.enabled = false;
	this.active = false;
	
	this.constrainEnabled = false;
	
	this.constrainCoordX = null;
	this.constrainCoordY = null;
}
Util.extend(Tool, TransformHandler);

Tool.prototype.activate = function() {
	if (!this.active) {
		this.active = true;
		this.enabled = true;
		window.addEventListener("mousedown", this, false);
		window.addEventListener("mousemove", this, false);
		window.addEventListener("keydown", this, false);
		window.addEventListener("keyup", this, false);
		
		if (this.mouseupFlag) {
			window.addEventListener("mouseup", this, false);
		}
	}
};

Tool.prototype.deactivate = function() {
	if (this.active) {
		this.active = false;
		this.enabled = false;
		window.removeEventListener("mousedown", this, false);
		window.removeEventListener("mousemove", this, false);
		window.removeEventListener("keydown", this, false);
		window.removeEventListener("keyup", this, false);
		
		if (this.mouseupFlag) {
			window.removeEventListener("mouseup", this, false);
		}
		
		this.toolTip.clearText();
		this.onDeactivate();
		this.reset();
	}
};

// Enable mouse- and key-downs
Tool.prototype.enable = function() {
	if (this.active && !this.enabled) {
		this.enabled = true;
		window.addEventListener("mousedown", this, false);
		window.addEventListener("keydown", this, false);
		window.addEventListener("keyup", this, false);
		
		if (this.mouseupFlag) {
			window.addEventListener("mouseup", this, false);
		}
	}
};

// Disable mouse- and key-downs
Tool.prototype.disable = function() {
	if (this.active && this.enabled) {
		this.enabled = false;
		window.removeEventListener("mousedown", this, false);
		window.removeEventListener("keydown", this, false);
		window.removeEventListener("keyup", this, false);
		
		if (this.mouseupFlag) {
			window.removeEventListener("mouseup", this, false);
		}
		
		this.toolTip.clearText();
	}
};

// Register shape with the current step and display it in the overlay group. 
// Automatically invokes SvgObject::push on that shape. If renderBelow is set
// to true, the registered shape will be rendered below other shapes in the
// underlay group.
Tool.prototype.registerShape = function(shape, name, renderBelow) {
	if (typeof name != "string" || name === "") {
		throw "Invalid name passed to Tool::registerShape.";
	} else if (this.getShape(name)) {
		throw "Duplicate name passed to Tool::registerShape.";
	}
	
	this.steps[this.currentStep].addShape(shape, name);
	shape.push();
	
	if (renderBelow) {
		this.underlayGroup.attachChild(shape);
	} else {
		this.overlayGroup.attachChild(shape);
	}
};

// Mark a shape for baking. Throws an exception if the shape name wasn't 
// found. Returns the shape.
Tool.prototype.bakeShape = function(name) {
	var shape;
	
	for (var i = 0; i <= this.currentStep; i++) {
		var shapes = this.steps[i].shapes;
		
		if (shapes[name]) {
			shape = shapes[name].shape;
			shapes[name].bakeFlag = true;
			break;
		}
	}
	
	if (!shape) {
		throw "Tool::bakeShape could not find shape with name '"+name+"'";
	}
	
	return shape;
};

// Remove a shape from the SVG document and immediately unregisters it. 
// Returns a reference to the shape, or null if no shape with such name found.
Tool.prototype.unregisterShape = function(name) {
	var shape;
	
	for (var i = 0; i <= this.currentStep; i++) {
		var shapes = this.steps[i].shapes;
		
		if (shapes[name]) {
			shape = shapes[name].shape.detach();
			delete shapes[name];
			break;
		}
	}
	
	return shape ? shape : null;
};

// Return the Coord2D of the mousedown that initiated the specified step.
Tool.prototype.getKeyCoordFromStep = function(stepNum) {
	return this.steps[stepNum] !== undefined ? this.steps[stepNum].keyCoord.clone() : undefined;
};

// Get previously registered shape
//
// TODO: Various functions such as unregisterShape, sendShapeToUnderlay, etc. 
// repeat the code in getShape when they should just use getShape. Clean up
// this filth.
Tool.prototype.getShape = function(name) {
	var shape;
	
	for (var i = 0; i <= this.currentStep; i++) {
		var shapes = this.steps[i].shapes;
		if (shapes[name]) {
			shape = shapes[name].shape;
			break;
		}
	}
	
	return shape ? shape : null;
};

// Move a shape from the overlay to the underlay
Tool.prototype.sendShapeToUnderlay = function(name) {
	var shape;
	
	for (var i = 0; i <= this.currentStep; i++) {
		var shapes = this.steps[i].shapes;
		
		if (shapes[name]) {
			var shape = shapes[name].shape;
			
			shape.detach();
			this.underlayGroup.attachChild(shape);
			
			break;
		}
	}
	
	if (!shape) {
		throw "Tool::sendShapeToUnderlay could not find shape with name '"+name+"'";
	}
	
	return shape;
};

// Move a shape from the underlay to the overlay
Tool.prototype.sendShapeToOverlay = function(name) {
	var shape;
	
	for (var i = 0; i <= this.currentStep; i++) {
		var shapes = this.steps[i].shapes;
		
		if (shapes[name]) {
			var shape = shapes[name].shape;
			
			shape.detach();
			this.overlayGroup.attachChild(shape);
			break;
		}
	}
	
	if (!shape) {
		throw "Tool::sendShapeToOverlay could not find shape with name '"+name+"'";
	}
	
	return shape;
};

Tool.prototype.displayTip = function(text, autoClear, hiPriority) {
	if (this.enabled) {
		this.toolTip.setText(text, autoClear, hiPriority);
	}
};

// Freezes internal mouse coordinates to the specified Coord2D. This is useful 
// for tools that can constrain mouse movements. Note that subsequent mouse-
// move events will clear the frozen coordinate.
Tool.prototype.setConstrainCoords = function(coord) {
	this.constrainCoordX = coord.x;
	this.constrainCoordY = coord.y;
};

// overriding TransformHandler::onMouseDown
Tool.prototype.onMouseDown = function(gx, gy, evt) {
	// Absorb the event so underlying objects aren't activated
	evt.stopPropagation();

	if (this.constrainEnabled && this.constrainCoordX) {
		gx = this.constrainCoordX;
		gy = this.constrainCoordY;
	}

	this.incrementStep(gx, gy);
	this.executeStep(this.currentStep, gx, gy);
	
	// Spoof a mousemove so shapes update immediately after creation
	this.invokeMouseMove(gx, gy);

	// Final step reached. Invoke inheriting class' complete method and reset tool.
	if (this.currentStep == this.numSteps - 1)  {
		this.completeTool();
	} else {
		if (evt.button == 2) {
			// If user right-clicked, short-circuit immediately after executing the step.
			if (this.currentStep >= this.minSteps - 1) {
				this.completeTool();
			}
		}
	}
};

Tool.prototype.onMouseUp = function(gx, gy, evt) {
	if (this.currentStep != -1) {
		this.onMouseDown(gx, gy, evt);
	}
};

Tool.prototype.invokeMouseMove = function(gx, gy) {
	if (this.currentStep >= 0) {
		this.mouseMoveDuringStep(this.currentStep, gx, gy, this.constrainEnabled && !this.snappingEnabled);
	}
};

// overriding TransformHandler::onMouseMove
Tool.prototype.onMouseMove = function(gx, gy, evt) {
	this.constrainCoordX = this.constrainCoordY = null;

	// Invoke inheriting class' specialized mouse move handler, only enabling
	// mouse-constrain if snapping is disabled.
	this.invokeMouseMove(gx, gy);
};

Tool.prototype.keydown = function(evt) {
	switch (evt.keyCode) {
		case UserInterface.escKeyCode:
			this.decrementStep();
			break;
		case UserInterface.enterKeyCode:
			if (this.currentStep >= this.minSteps - 1) {
				this.completeTool();
			}
			break;
		case UserInterface.shiftKeyCode:
			if (!evt.altKey && !evt.ctrlKey && !evt.metaKey) {
				this.constrainEnabled = true;
			
				// Spoof a mousemove so shapes will update to constrained position
				p = this.getLastMousePosition();
				this.invokeMouseMove(p.x, p.y);
			}
			break;
		case UserInterface.snapKeyCode:
			this.enableSnapping();
			break;
	}
};

Tool.prototype.keyup = function(evt) {
	switch (evt.keyCode) {
		case UserInterface.shiftKeyCode:
			this.constrainEnabled = false;
		
			// Spoof a mousemove so shapes will update to constrained position
			p = this.getLastMousePosition();
			this.invokeMouseMove(p.x, p.y);
			break;
		case UserInterface.snapKeyCode:
			this.disableSnapping();
			break;
	}
};

// Advance the step counter and prepare new step
Tool.prototype.incrementStep = function(gx, gy) {
	this.currentStep++;
	this.steps[this.currentStep] = new ToolStep(gx, gy);
};

// Remove all shapes belonging to the current step from the SVG document and 
// immediately unregister them, then decrement the step counter.
Tool.prototype.decrementStep = function() {
	this.toolTip.clearText();
	
	if (this.currentStep >= 0) {
		this.unregisterShapesInCurrentStep();
		this.steps.pop();
		
		this.currentStep--;
		
		if (this.currentStep == -1) {
			// Reset the tool if it is now step 0.
			this.reset();
		} else {
			// Re-execute the previous step exactly as it was executed before.
			var pa = this.getLastMousePosition();
			var pb = this.getKeyCoordFromStep(this.currentStep);
			
			this.unregisterShapesInCurrentStep();
			this.executeStep(this.currentStep, pb.x, pb.y, this.constrainEnabled && !this.snappingEnabled);
			this.invokeMouseMove(pa.x, pa.y);
		}
	}
};

// Finalizes all shapes that were registered with the bake flag set to true
// by first unregistering them and then attaching them to the current layer.
Tool.prototype.bake = function() {
	this.undoManager.recordStart();
	
	for (var i = 0; i <= this.currentStep; i++) {
		var shapes = this.steps[i].shapes;
		for (var name in shapes) {
			if (shapes[name].bakeFlag) {
				var shape = this.unregisterShape(name);
				
				this.undoManager.push(this.layerManager,
					this.layerManager.insertShape, [shape],
					this.layerManager.deleteShape, [shape]);
			}
		}
	}
	
	this.undoManager.recordStop();
};

Tool.prototype.completeTool = function() {
	this.complete(this.currentStep, this.constrainEnabled);
	this.bake();
	this.reset();
};

Tool.prototype.unregisterShapesInCurrentStep = function() {
	if (this.currentStep >= 0) {
		var shapes = this.steps[this.currentStep].shapes;
		for (var name in shapes) {
			shapes[name].shape.detach();
			delete shapes[name];
		}
	}
};

Tool.prototype.reset = function() {
	// Remove all registered shapes from the SVG document
	for (var i = 0; i <= this.currentStep; i++) {
		for (var name in this.steps[i].shapes) {
			this.steps[i].shapes[name].shape.detach();
		}
	}
	
	// Begin from step zero
	this.steps = [];
	this.currentStep = -1;
	
	// Clear any tooltips
	this.toolTip.clearText();
};

// Abstract function. Executes the given step. Must be overridden!
Tool.prototype.executeStep = function(stepNum, gx, gy) {
	throw "Abstract function Tool::executeStep not implemented by inheriting class!";
};

// Abstract function. Invoked after final step of tool or after user short-
// circuited the tool. Must be overridden!
Tool.prototype.complete = function(stepNum) {
	throw "Abstract function Tool::complete not implemented by inheriting class!";
};

// Abstract function. Called during mousemoves. Optionally overriden.
Tool.prototype.mouseMoveDuringStep = function(stepNum, gx, gy) {};

// Abstract function. Called when the tool is deactivated.
Tool.prototype.onDeactivate = function() {};

/*
 * ToolStep
 * 
 * Helper class for Tool, representing an individual tool step.
 * 
 * * */ 

function ToolStep(x, y) {
	this.keyCoord = new Coord2D(x, y);
	this.shapes = {};                     // associative array of shapes registered during this step
}

ToolStep.prototype.addShape = function(shape, name, bakeFlag) {
	this.shapes[name] = {"shape":shape, "bakeFlag":bakeFlag};
};