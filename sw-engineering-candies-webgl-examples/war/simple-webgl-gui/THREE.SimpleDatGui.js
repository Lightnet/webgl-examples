/*******************************************************************************
 * Copyright (C) 2015, Markus Sprunck All rights reserved. Redistribution and
 * use in source and binary forms, with or without modification, are permitted
 * provided that the following conditions are met: - Redistributions of source
 * code must retain the above copyright notice, this list of conditions and the
 * following disclaimer. - Redistributions in binary form must reproduce the
 * above copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the distribution. -
 * The name of its contributor may be used to endorse or promote products
 * derived from this software without specific prior written permission. THIS
 * SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 ******************************************************************************/

/**
 * Implement a simple rendering with pure WebGL based on three.js without any
 * other 3rd party libraries. The look & feel should be like in the Chrome
 * Experiment DAT.GUI (see
 * http://workshop.chromeexperiments.com/examples/gui/#1--Basic-Usage). This is
 * an early development stage, so some features are missing and/or not 100%
 * tested.
 */
THREE.SimpleDatGui = function(scene, camera, renderer, parameters) {
    "use strict";
    console.log('THREE.SimpleDatGui v0.5 (alpha)');

    // TODO Implement control color picker
    // TODO Implement control combo box
    // TODO Workaround to show keyboard on iOS
    // TODO Fix mouse pointer in text edit control
    // TODO Support floats in slider control
    // TODO Implement save & restore of values
    // TODO Implement copy & paste for text control

    // CALCULATE RENDERING OPTIONS
    parameters = parameters || {};
    var width = (parameters.width !== undefined) ? parameters.width : 300;
    var position = (parameters.position !== undefined) ? parameters.position : new THREE.Vector3(-150, 100, 150);
    this.options = this.SimpleDatGuiOptionsFunction(position, width);

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.domElement = renderer.domElement;

    this.closeButton = new THREE.SimpleDatGuiControl(null, "Close Controls", 0, 0, this, true, this.options);
    this.children = [];
    this.mouseSensitiveObjects = [];

    this.closed = false;
    this.focus = null;
    this.selected = null;
    this.opacityGui = 100;

    var that = this;
    this.renderer.domElement.addEventListener('mousemove', function(e) {
        that.onMouseEvt(e);
    });

    this.renderer.domElement.addEventListener('mousedown', function(e) {
        that.onMouseEvt(e);
    });

    window.addEventListener('keydown', function(e) {
        that.onKeyEvt(e);
    }.bind(this));

    window.addEventListener('keypress', function(e) {
        that.onKeyPressEvt(e);
    }.bind(this));

};

THREE.SimpleDatGui.prototype.SimpleDatGuiOptionsFunction = function(position, width) {

    var deltaz = 0.1;
    var fontSize = 8;
    var rightBorder = 4;
    var offesetX = 2;
    var area = new THREE.Vector3(width, 20, 2.0);
    var valueFiledSize = new THREE.Vector3(0.2 * area.x, 14, deltaz);
    var labelTab1 = new THREE.Vector3(0.4 * area.x, 20, 2.0);
    var labelTab2 = new THREE.Vector3(area.x - rightBorder - valueFiledSize.x, 20, 2.0);

    return {
                POSITION: position,
                AREA_SIZE: area,
                DELTA_Z: deltaz,
                FONT_SIZE: fontSize,
                RIGHT_BORDER: rightBorder,
                VALUE_TEXT_OFFSET_X: offesetX,
                TEXT_FIELD_SIZE: new THREE.Vector3(0.6 * area.x - rightBorder, 14, deltaz),
                VALUE_FIELD_SIZE: valueFiledSize,
                LABEL_TAB_1: labelTab1,
                LABEL_TAB_2: labelTab2,
                VALUE_SLIDER_FIELD_SIZE: new THREE.Vector3(labelTab2.x - labelTab1.x - rightBorder, 14, deltaz),
                MARKER_SIZE: new THREE.Vector3(3, area.y, area.z),
                CHECKBOX_SIZE: new THREE.Vector3(10, 10, deltaz)
    }
}

THREE.SimpleDatGui.prototype.update = function() {
    "use strict";

    // UPDATE RENDERING OF ALL CONTROLS
    var that = this;
    var indexOfVisibleControls = -1;
    this.children.forEach(function(child) {
        if (!child.isElementHidden) {
            indexOfVisibleControls++;
        }
        child.updateRendering(indexOfVisibleControls, that.closed);

        child.children.forEach(function(element) {
            if (!element.isElementHidden) {
                indexOfVisibleControls++;
            }
            element.updateRendering(indexOfVisibleControls, that.closed);
        });
    });
    this.closeButton.updateRendering((that.closed) ? 0 : (indexOfVisibleControls + 1), false);

    // JUST VISIBLE CONTROLS INTERACT WITH MOUSE
    var that = this;
    this.mouseSensitiveObjects = [];
    if (!this.closed) {
        this.children.forEach(function(child) {
            // ALL VISIBLE FOLDER
            if (!child.isElementHidden) {
                if (!that.isElementFolder && child.isSliderControl()) {
                    that.mouseSensitiveObjects.push(child.wValueSliderBar);
                    that.mouseSensitiveObjects.push(child.wValueSliderField);
                } else {
                    that.mouseSensitiveObjects.push(child.wArea);
                }
            }
            // ALL CONTROLS
            child.children.forEach(function(element) {
                if (!element.isElementHidden) {
                    if (!that.isElementFolder && element.isSliderControl()) {
                        that.mouseSensitiveObjects.push(element.wValueSliderBar);
                        that.mouseSensitiveObjects.push(element.wValueSliderField);
                    } else {
                        that.mouseSensitiveObjects.push(element.wArea);
                    }
                }
            });
        });
    }
    that.mouseSensitiveObjects.push(this.closeButton.wArea);
};

THREE.SimpleDatGui.prototype.updateCloseButtonText = function() {
    this.closeButton.createLabel(this.closed ? "Open Controls" : "Close Controls");
}

THREE.SimpleDatGui.prototype.onMouseEvt = function(event) {
    "use strict";

    // DECODE MOUSE EVENTS
    var mouse = {};
    mouse.x = ((event.clientX) / (window.innerWidth - this.domElement.offsetLeft)) * 2 - 1;
    mouse.y = -((event.clientY - this.domElement.offsetTop) / (this.domElement.clientHeight)) * 2 + 1;

    if (typeof (this.camera) !== "undefined") {
        this.selected = null;

        var vector = new THREE.Vector3(mouse.x, mouse.y, 0.5);
        vector.unproject(this.camera);
        var raycaster = new THREE.Raycaster(this.camera.position, vector.sub(this.camera.position).normalize());
        var intersects = raycaster.intersectObjects(this.mouseSensitiveObjects);
        if (intersects.length > 0) {
            var _element = intersects[0].object.WebGLElement;
            if (event.type === "mousemove") {
                this.selected = _element;
            } else if (event.type === "mousedown" && event.which == 1) {
                var _threeObject = intersects[0].object;
                this.focus = _element;

                if (_element === this.closeButton) {
                    this.closed = !this.closed;
                    this.updateCloseButtonText();
                } else if (_element.isSliderControl()) {
                    var _sliderType = intersects[0].object.sliderType;
                    var _increment = (_element.step == null) ? 1 : _element.step;
                    if (_sliderType === "bar") {
                        _element.object[_element.property] -= _increment;
                        _element.object[_element.property] = Math.max(_element.object[_element.property],
                                    _element.minValue);
                    } else if (_sliderType === "field") {
                        _element.object[_element.property] += _increment;
                        _element.object[_element.property] = Math.min(_element.object[_element.property],
                                    _element.maxValue);
                    } else {
                        console.warn("unexpected sliderType ");
                    }

                } else if (_element.isTextControl()) {
                    this.selected = _element;
                    var value = this.focus.object[this.focus.property];
                    this.focus.intersectX = intersects[0].point.x;

                    // Workaround to activate keyboard on iOS | START
                    focusInput();
                    // Workaround to activate keyboard on iOS | END

                    // FIND NEW CURSOR this.options.POSITION
                    var cursorMinimalX = _element.wValueTextField.position.x - this.options.TEXT_FIELD_SIZE.x / 2;
                    var deltaX = intersects[0].point.x - cursorMinimalX;
                    if (deltaX > _element.possibleCursorPositons[_element.possibleCursorPositons.length - 1].x) {
                        _element.textHelper.end = value.length - 1;
                        _element.textHelper.cursor = value.length;
                        _element.textHelper.calculateAlignTextLastCall(value);
                    } else {
                        for (var i = 0; i < _element.possibleCursorPositons.length - 1; i++) {
                            var minX = _element.possibleCursorPositons[i].x;
                            var maxX = _element.possibleCursorPositons[i + 1].x;
                            if (deltaX > minX && deltaX <= maxX) {
                                _element.textHelper.cursor = i + _element.textHelper.start;
                            }
                        }
                    }

                }
                _element.executeCallback();
            }
            return false;
        }
    }
    return true;
}

THREE.SimpleDatGui.prototype.onKeyPressEvt = function(event) {
    "use strict";
    if (this.focus !== null) {
        var value = this.focus.object[this.focus.property];
        var newCharacter = String.fromCharCode(event.keyCode);
        var newValue = value.substring(0, this.focus.textHelper.cursor) + newCharacter
                    + value.substring(this.focus.textHelper.cursor, value.length);

        this.focus.textHelper.cursor = this.focus.textHelper.cursor + 1;
        this.focus.textHelper.calculateAlignTextLastCall(newValue);

        this.focus.lastValue = newValue;
        this.focus.object[this.focus.property] = newValue;
        this.focus.executeCallback();

        this.focus.createTextValue(this.focus.textHelper.truncated);
    }
}

THREE.SimpleDatGui.prototype.onKeyEvt = function(event) {
    "use strict";
    if (this.focus !== null) {
        var value = this.focus.object[this.focus.property];

        if (event.keyCode === 9 /* TAB */|| event.keyCode === 13 /* ENTER */) {
            this.focus = null;

            // Workaround to activate keyboard on iOS | START
            blurInput();
            // Workaround to activate keyboard on iOS | END

        } else if (event.keyCode === 36 /* POS1 */) {
            this.focus.textHelper.cursor = 0;
            this.focus.textHelper.start = 0;
            this.focus.textHelper.calculateAlignTextLastCall(value);
        } else if (event.keyCode === 35 /* END */) {
            this.focus.textHelper.cursor = value.length;
            this.focus.textHelper.end = value.length - 1;
            this.focus.textHelper.calculateAlignTextLastCall(value);
        } else if (event.keyCode === 37 /* LEFT */) {
            if (this.focus.textHelper.cursor > 0) {
                this.focus.textHelper.cursor -= 1;
            }
            if (this.focus.textHelper.start > this.focus.textHelper.cursor) {
                if (this.focus.textHelper.start > 0) {
                    this.focus.textHelper.start--;
                }
                this.focus.textHelper.calculateAlignTextLastCall(value);
            }
        } else if (event.keyCode === 39/* RIGHT */&& this.focus.textHelper.cursor < value.length) {
            this.focus.textHelper.cursor += 1;
            if (this.focus.textHelper.cursor > this.focus.textHelper.end) {
                this.focus.textHelper.calculateAlignTextLastCall(value);
            }
        } else if (event.keyCode === 46 /* ENTF */) {
            var value = this.focus.object[this.focus.property];
            var valueNew = value.substring(0, this.focus.textHelper.cursor)
                        + value.substring(this.focus.textHelper.cursor + 1, value.length);

            this.focus.textHelper.calculateAlignTextLastCall(valueNew);

            this.focus.lastValue = valueNew;
            this.focus.object[this.focus.property] = valueNew;
            this.focus.executeCallback();

        } else if (event.keyCode === 8 /* BACK_SPACE */) {
            // prevent default behaviour
            event.preventDefault();

            var value = this.focus.object[this.focus.property];
            if (this.focus.textHelper.cursor > 0) {

                var newValue = value.substring(0, this.focus.textHelper.cursor - 1)
                            + value.substring(this.focus.textHelper.cursor, value.length);

                this.focus.textHelper.cursor -= 1;
                this.focus.textHelper.calculateAlignTextLastCall(newValue);

                this.focus.lastValue = newValue;
                this.focus.object[this.focus.property] = newValue;
                this.focus.executeCallback();
            }
        }
        this.focus.createTextValue(this.focus.textHelper.truncated);
    }
}

THREE.SimpleDatGui.prototype.addFolder = function(name) {
    "use strict";
    var _element = new THREE.SimpleDatGuiControl(null, name, 0, 0, this, false, this.options);
    this.children.push(_element);
    return _element;
}

THREE.SimpleDatGui.prototype.setOpacity = function(opacity) {
    "use strict";
    this.opacityGui = Math.max(20, Math.min(100, opacity));
    return this;
}

THREE.SimpleDatGui.prototype.close = function() {
    "use strict";
    this.closed = true;
    this.updateCloseButtonText();
    return this;
}

// /////////////////////////////////////////////////////////////////////////////

THREE.SimpleDatGuiControl = function(object, property, minValue, maxValue, parent, isCloseButton, options) {
    "use strict";

    var COLOR_BODER = '0x2c2c2c';
    var COLOR_VALUE_FIELD = '0x303030';
    var COLOR_NUMBER_FIELD = '0x2fa1d6';

    var WEBGL_LABEL_OFFSET_X = 10;
    var WEBGL_CLOSE_LABEL_OFFSET_X = 30;
    var WEBGL_LABEL_OFFSET_Y = 3;

    var that = this;

    // ATTRIBUTES
    this.options = options;
    this.object = object;
    this.property = property;
    this.propertyType = (object != null) ? typeof object[property] : "folder";
    this.label = property;
    this.onChangeCallback = null;
    this.isCloseButton = isCloseButton;

    // MANAGE NUMBER INPUT
    this.minValue = 0.0;
    this.maxValue = 1000.0;

    // MANAGE TEXT INPUT
    this.textHelper = new THREE.SimpleDatGuiTextHelper(this.options);
    this.possibleCursorPositons = [];

    // STATE
    this.isFolderCollapsed = true;
    this.isElementFolder = this.propertyType === "folder";
    this.isElementHidden = !this.isElementFolder;
    this.isOnChangeExisting = false;
    this.scaling = 1.0;
    this.hasFocus = false;
    this.intersectX = 0;
    this.isClosed = false;

    // LISTER
    this.updateTimer;
    this.lastValue;

    // RELATIVES
    this.parent = parent;
    this.children = [];

    this.createArea = function() {
        var _geometry = new THREE.BoxGeometry(this.options.AREA_SIZE.x, this.options.AREA_SIZE.y,
                    this.options.AREA_SIZE.z);
        var _material = new THREE.MeshBasicMaterial({
            transparent: true
        });
        that.wArea = new THREE.Mesh(_geometry, _material);
        that.wArea.WebGLElement = that;
        that.wArea.updateRendering = function(index) {
            that.wArea.position.x = that.options.POSITION.x + that.options.AREA_SIZE.x / 2;
            that.wArea.position.y = that.options.POSITION.y - that.options.AREA_SIZE.y / 2 - that.options.AREA_SIZE.y
                        * index;
            that.wArea.position.z = that.options.POSITION.z + that.options.AREA_SIZE.z / 2;
            that.wArea.material.opacity = that.parent.opacityGui * 0.01;
            that.wArea.material.visible = that.isVisible() && !that.isClosed;
        };
        that.parent.scene.add(that.wArea);
    }

    this.createFrame = function() {
        var _geometryBox = new THREE.BoxGeometry(this.options.AREA_SIZE.x, this.options.AREA_SIZE.y, 0.1);
        var _geometry = cubeGeometry2LineGeometry(_geometryBox);
        that.wFrame = new THREE.Line(_geometry, new THREE.LineBasicMaterial({
                    color: 0x161616,
                    transparent: true
        }));
        that.wFrame.material.color.setHex(COLOR_BODER);
        that.wFrame.updateRendering = function(index) {
            that.wFrame.position.x = that.options.POSITION.x + that.options.AREA_SIZE.x / 2 - 0.1;
            that.wFrame.position.y = that.options.POSITION.y - that.options.AREA_SIZE.y / 2 - that.options.AREA_SIZE.y
                        * index;
            that.wFrame.position.z = that.options.POSITION.z + that.options.AREA_SIZE.z + that.options.DELTA_Z;
            that.wFrame.material.opacity = that.parent.opacityGui * 0.01;
            that.wFrame.material.visible = that.isVisible() && !that.isClosed;
        };
        that.parent.scene.add(that.wFrame);
    }

    this.createMarker = function() {
        var _geometry = new THREE.BoxGeometry(this.options.MARKER_SIZE.x, this.options.MARKER_SIZE.y,
                    this.options.MARKER_SIZE.z);
        var _material = new THREE.MeshBasicMaterial({
            transparent: true
        });
        that.wMarker = new THREE.Mesh(_geometry, _material);
        that.wMarker.updateRendering = function(index) {
            that.wMarker.position.x = that.options.POSITION.x + that.options.MARKER_SIZE.x / 2 - 0.1;
            that.wMarker.position.y = that.options.POSITION.y - that.options.AREA_SIZE.y / 2 - that.options.AREA_SIZE.y
                        * index;
            that.wMarker.position.z = that.options.POSITION.z + that.options.AREA_SIZE.z / 2 + that.options.DELTA_Z;
            that.wMarker.material.opacity = that.parent.opacityGui * 0.01;
            that.wMarker.material.visible = that.isVisible() && !that.isClosed;
        };
        that.parent.scene.add(that.wMarker);
    }

    this.createLabel = function(name) {
        if (typeof that.wLabel !== "undefined") {
            that.parent.scene.remove(that.wLabel);
        }
        var fontshapes = THREE.FontUtils.generateShapes(name, {
            size: this.options.FONT_SIZE
        });
        var _geometry = new THREE.ShapeGeometry(fontshapes, {
            curveSegments: 2
        });
        that.wLabel = new THREE.Mesh(_geometry, new THREE.MeshBasicMaterial({
            transparent: true
        }));
        that.wLabel.updateRendering = function(index) {
            that.wLabel.position.x = that.options.POSITION.x
                        + ((that.isCloseButton) ? (that.options.AREA_SIZE.x / 2 - WEBGL_CLOSE_LABEL_OFFSET_X)
                                    : WEBGL_LABEL_OFFSET_X);
            that.wLabel.position.y = that.options.POSITION.y + that.options.AREA_SIZE.y * (-0.5 - index)
                        - WEBGL_LABEL_OFFSET_Y;
            that.wLabel.position.z = that.options.POSITION.z + that.options.AREA_SIZE.z + that.options.DELTA_Z;
            that.wLabel.material.opacity = that.parent.opacityGui * 0.01;
            that.wLabel.material.visible = that.isVisible() && !that.isClosed;
        };
        that.parent.scene.add(that.wLabel);
    }

    this.createCheckBoxes = function() {
        // CREATE CHECKBOX AREA
        var _geometry = new THREE.BoxGeometry(this.options.CHECKBOX_SIZE.x, that.options.CHECKBOX_SIZE.y,
                    this.options.CHECKBOX_SIZE.z);
        var _material = new THREE.MeshBasicMaterial({
            transparent: true
        });
        that.wBoxUnChecked = new THREE.Mesh(_geometry, _material);
        that.wBoxUnChecked.visible = false;
        that.wBoxUnChecked.updateRendering = function(index) {
            that.wBoxUnChecked.position.x = that.options.POSITION.x + that.options.LABEL_TAB_1.x
                        + that.options.CHECKBOX_SIZE.x / 2;
            that.wBoxUnChecked.position.y = that.options.POSITION.y + that.options.AREA_SIZE.y * (-0.5 - index);
            that.wBoxUnChecked.position.z = that.options.POSITION.z + that.options.AREA_SIZE.z + that.options.DELTA_Z;
            that.wBoxUnChecked.material.opacity = that.parent.opacityGui * 0.01;
        };
        that.parent.scene.add(that.wBoxUnChecked);

        // CREATE CHECKBOX MARKER
        var fontshapes = THREE.FontUtils.generateShapes("X", {
            size: 7
        });
        var _geometry = new THREE.ShapeGeometry(fontshapes, {
            curveSegments: 2
        });
        var _material = new THREE.MeshLambertMaterial({
                    color: 0x000000,
                    depthTest: true,
                    transparent: true
        });
        that.wBoxChecked = new THREE.Mesh(_geometry, _material);
        that.wBoxChecked.visible = false;
        that.wBoxChecked.updateRendering = function(index) {
            that.wBoxChecked.position.x = that.options.POSITION.x + that.options.LABEL_TAB_1.x
                        + that.options.CHECKBOX_SIZE.x / 2 - 3;
            that.wBoxChecked.position.y = that.options.POSITION.y + that.options.AREA_SIZE.y * (-0.5 - index) - 3.5;
            that.wBoxChecked.position.z = that.options.POSITION.z + that.options.AREA_SIZE.z + that.options.DELTA_Z * 2;
            that.wBoxChecked.material.opacity = that.parent.opacityGui * 0.01;
        };
        that.parent.scene.add(that.wBoxChecked);
    }

    var cubeGeometry2LineGeometry = function(input) {
        "use strict";
        var _geometry = new THREE.Geometry();
        var vertices = _geometry.vertices;
        for (var i = 0; i < input.faces.length; i += 2) {
            var face1 = input.faces[i];
            var face2 = input.faces[i + 1];
            var c1 = input.vertices[face1.c].clone();
            var a1 = input.vertices[face1.a].clone();
            var a2 = input.vertices[face2.a].clone();
            var b2 = input.vertices[face2.b].clone();
            var c2 = input.vertices[face2.c].clone();
            vertices.push(c1, a1, a2, b2, b2, c2);
        }
        _geometry.computeLineDistances();
        return _geometry;
    }

    this.createValue = function(value) {

        if (typeof that.wValue !== "undefined") {
            that.parent.scene.remove(that.wValue);
        }
        var fontshapes = THREE.FontUtils.generateShapes(value, {
            size: this.options.FONT_SIZE
        });
        var _geometry = new THREE.ShapeGeometry(fontshapes, {
            curveSegments: 2
        });
        that.wValue = new THREE.Mesh(_geometry, new THREE.MeshBasicMaterial({
            transparent: true
        }));
        that.wValue.updateRendering = function(index) {
            that.wValue.position.x = that.options.POSITION.x + that.options.LABEL_TAB_2.x
                        + that.options.VALUE_TEXT_OFFSET_X;
            that.wValue.position.y = that.options.POSITION.y + that.options.AREA_SIZE.y * (-0.5 - index)
                        - WEBGL_LABEL_OFFSET_Y;
            that.wValue.position.z = that.options.POSITION.z + that.options.AREA_SIZE.z + that.options.DELTA_Z * 2;
            that.wValue.material.opacity = that.parent.opacityGui * 0.01;
            that.wValue.visible = that.isSliderControl() && that.isVisible() && !that.isClosed;
        };
        that.parent.scene.add(that.wValue);
    }

    this.createValueField = function() {
        var _geometry = new THREE.BoxGeometry(this.options.VALUE_FIELD_SIZE.x, this.options.VALUE_FIELD_SIZE.y,
                    this.options.VALUE_FIELD_SIZE.z);
        var _material = new THREE.MeshBasicMaterial({
            transparent: true
        });
        _material.color.setHex(COLOR_VALUE_FIELD);
        that.wValueField = new THREE.Mesh(_geometry, _material);
        that.wValueField.updateRendering = function(index) {
            that.wValueField.position.x = that.options.POSITION.x + that.options.LABEL_TAB_2.x
                        + that.options.VALUE_FIELD_SIZE.x / 2;
            that.wValueField.position.y = that.options.POSITION.y + that.options.AREA_SIZE.y * (-0.5 - index);
            that.wValueField.position.z = that.options.POSITION.z + that.options.AREA_SIZE.z + that.options.DELTA_Z;
            that.wValueField.material.opacity = that.parent.opacityGui * 0.01;
            that.wValueField.visible = that.isSliderControl() && that.isVisible() && !that.isClosed;
        };
        that.parent.scene.add(that.wValueField);
    }

    this.createValueSliderField = function() {
        var _geometry = new THREE.BoxGeometry(this.options.VALUE_SLIDER_FIELD_SIZE.x,
                    this.options.VALUE_SLIDER_FIELD_SIZE.y, this.options.VALUE_SLIDER_FIELD_SIZE.z);
        var _material = new THREE.MeshBasicMaterial({
            transparent: true
        });
        _material.color.setHex(COLOR_VALUE_FIELD);
        that.wValueSliderField = new THREE.Mesh(_geometry, _material);
        that.wValueSliderField.sliderType = "field";
        that.wValueSliderField.WebGLElement = that;
        that.wValueSliderField.updateRendering = function(index) {
            that.wValueSliderField.position.x = that.options.POSITION.x + that.options.LABEL_TAB_1.x
                        + that.options.VALUE_SLIDER_FIELD_SIZE.x / 2;
            that.wValueSliderField.position.y = that.options.POSITION.y + that.options.AREA_SIZE.y * (-0.5 - index);
            that.wValueSliderField.position.z = that.options.POSITION.z + that.options.AREA_SIZE.z
                        + that.options.DELTA_Z;
            that.wValueSliderField.material.opacity = that.parent.opacityGui * 0.01;
            that.wValueSliderField.visible = that.isSliderControl() && that.isVisible() && !that.isClosed;
        };
        that.parent.scene.add(that.wValueSliderField);
    }

    this.createValueTextField = function() {
        var _geometry = new THREE.BoxGeometry(this.options.TEXT_FIELD_SIZE.x, this.options.TEXT_FIELD_SIZE.y,
                    this.options.TEXT_FIELD_SIZE.z);
        var _material = new THREE.MeshBasicMaterial({
            transparent: true
        });
        _material.color.setHex(COLOR_VALUE_FIELD);
        that.wValueTextField = new THREE.Mesh(_geometry, _material);
        that.wValueTextField.visible = false;
        that.wValueTextField.WebGLElement = that;
        that.wValueTextField.updateRendering = function(index) {
            that.wValueTextField.position.x = that.options.POSITION.x + that.options.LABEL_TAB_1.x
                        + that.options.TEXT_FIELD_SIZE.x / 2;
            that.wValueTextField.position.y = that.options.POSITION.y + that.options.AREA_SIZE.y * (-0.5 - index);
            that.wValueTextField.position.z = that.options.POSITION.z + that.options.AREA_SIZE.z + that.options.DELTA_Z;
            that.wValueTextField.material.opacity = that.parent.opacityGui * 0.01;
            that.wValueTextField.visible = that.isVisible() && that.isTextControl() && !that.isClosed;
        };
        that.parent.scene.add(that.wValueTextField);
    }

    this.createTextValue = function(value) {

        if (typeof that.wTextValue !== "undefined") {
            that.parent.scene.remove(that.wTextValue);
        }

        var fontshapes = THREE.FontUtils.generateShapes(that.textHelper.truncated, {
            size: this.options.FONT_SIZE
        });
        that.possibleCursorPositons = [];
        that.possibleCursorPositons.push({
            x: 0
        });
        for (var i = 0; i < fontshapes.length; i++) {
            that.possibleCursorPositons.push({
                x: fontshapes[i].getBoundingBox().maxX
            });
        }
        var _geometry = new THREE.ShapeGeometry(fontshapes, {
            curveSegments: 2
        });
        that.wTextValue = new THREE.Mesh(_geometry, new THREE.MeshBasicMaterial({
                    color: 0x1ed36f,
                    transparent: true,
        }));
        that.wTextValue.updateRendering = function(index) {
            that.wTextValue.position.x = that.options.POSITION.x + that.options.LABEL_TAB_1.x
                        + that.textHelper.residiumX;
            that.wTextValue.position.y = that.options.POSITION.y + that.options.AREA_SIZE.y * (-0.5 - index)
                        - WEBGL_LABEL_OFFSET_Y;
            that.wTextValue.position.z = that.options.POSITION.z + that.options.AREA_SIZE.z + that.options.DELTA_Z * 2;
            that.wTextValue.material.opacity = that.parent.opacityGui * 0.01;
            that.wTextValue.visible = that.isVisible() && that.isTextControl() && !that.isClosed;
        };
        that.parent.scene.add(that.wTextValue);
    }

    this.createValueSliderBar = function(scaling) {

        if (typeof that.wValueSliderBar !== "undefined") {
            that.parent.scene.remove(that.wValueSliderBar);
        }
        var _geometry = new THREE.BoxGeometry(this.options.VALUE_SLIDER_FIELD_SIZE.x * scaling,
                    this.options.VALUE_SLIDER_FIELD_SIZE.y, this.options.VALUE_SLIDER_FIELD_SIZE.z);
        var _material = new THREE.MeshBasicMaterial({
            transparent: true
        });
        that.wValueSliderBar = new THREE.Mesh(_geometry, _material);
        that.wValueSliderBar.sliderType = "bar";
        that.wValueSliderBar.WebGLElement = that;
        that.wValueSliderBar.updateRendering = function(index) {
            that.wValueSliderBar.position.x = that.options.POSITION.x + that.options.LABEL_TAB_1.x
                        + that.options.VALUE_SLIDER_FIELD_SIZE.x / 2 - that.options.VALUE_SLIDER_FIELD_SIZE.x
                        * (1 - that.scaling) / 2;
            that.wValueSliderBar.position.y = that.options.POSITION.y + that.options.AREA_SIZE.y * (-0.5 - index);
            that.wValueSliderBar.position.z = that.options.POSITION.z + that.options.AREA_SIZE.z + that.options.DELTA_Z
                        * 2;
            that.wValueSliderBar.material.opacity = that.parent.opacityGui * 0.01;
            that.wValueSliderBar.visible = that.isSliderControl() && that.isVisible()
                        && (that.object[that.property] > that.minValue) && !that.isClosed;
        };
        that.parent.scene.add(that.wValueSliderBar);
    }

    this.createCursor = function() {
        var _geometry = new THREE.BoxGeometry(0.5, this.options.TEXT_FIELD_SIZE.y * 0.8, 0.1);
        var _material = new THREE.MeshBasicMaterial({
            transparent: true
        });
        that.wCursor = new THREE.Mesh(_geometry, _material);

        that.wCursor.updateRendering = function(index) {
            var possiblePositon = that.possibleCursorPositons[that.textHelper.cursor - that.textHelper.start];
            if (typeof possiblePositon !== "undefined") {
                that.wCursor.position.x = that.options.POSITION.x + that.options.LABEL_TAB_1.x
                            + that.textHelper.residiumX + possiblePositon.x + 0.25;
                that.wCursor.position.y = that.options.POSITION.y + that.options.AREA_SIZE.y * (-0.5 - index);
                that.wCursor.position.z = that.options.POSITION.z + that.options.AREA_SIZE.z + that.options.DELTA_Z * 2;
                that.wCursor.material.opacity = that.parent.opacityGui * 0.01;
                that.wCursor.material.visible = that.isVisible() && that.isTextControl()
                            && (that.parent.focus === that) && !that.isClosed;
            } else {
                that.wCursor.material.visible = false;
            }
        };
        that.parent.scene.add(that.wCursor);
    }

    // CREATE NEEDED CONTROLS
    this.createArea();
    this.createLabel(this.label);
    this.createMarker();

    if (!this.isCloseButton) {
        this.createFrame();
    }

    if (this.isFunctionControl()) {
        this.onChangeCallback = object[property];
    } else if (this.isCheckBoxControl()) {
        this.createCheckBoxes();
        this.object = object;
        this.property = property;
    } else if (this.isSliderControl()) {
        this.createValue("");
        this.createValueField();
        this.createValueSliderField();
        this.createValueSliderBar();
        this.object = object;
        this.property = property;
        this.minValue = minValue;
        this.maxValue = maxValue;
        this.createValue(object[property]);
    } else if (this.isTextControl()) {
        this.textHelper.calculateLeftAlignText("");
        this.createValueTextField();
        this.createTextValue("");
        this.createCursor();
        this.object = object;
        this.property = property;
        this.createTextValue(object[property]);
    }

    this.listenInternal();
}

THREE.SimpleDatGuiControl.prototype.updateRendering = function(index, isClosed) {
    "use strict";
    this.isClosed = isClosed;

    this.wArea.updateRendering(index);
    this.wLabel.updateRendering(index);
    this.wMarker.updateRendering(index);

    if (!this.isCloseButton) {
        this.wFrame.updateRendering(index);
    }

    if (this.isCheckBoxControl()) {
        this.wBoxChecked.updateRendering(index);
        this.wBoxUnChecked.updateRendering(index);
    } else if (this.isSliderControl()) {
        this.wValue.updateRendering(index);
        this.wValueField.updateRendering(index);
        this.wValueSliderField.updateRendering(index);
        this.wValueSliderBar.updateRendering(index);
    } else if (this.isTextControl()) {
        this.wValueTextField.updateRendering(index);
        this.wTextValue.updateRendering(index);
        this.wCursor.updateRendering(index);
    }

    if (!this.isElementFolder && this.isCheckBoxControl()) {
        var checked = this.object[this.property];
        this.wBoxChecked.visible = this.isVisible() && checked && !this.isClosed;
        this.wBoxUnChecked.visible = this.isVisible() && !this.isClosed;
    }

    this.updateColor();

    return this;
}

THREE.SimpleDatGuiControl.prototype.onChange = function(value) {
    "use strict";
    this.isOnChangeExisting = true;
    this.onChangeCallback = value;
    return this;
}

THREE.SimpleDatGuiControl.prototype.add = function(object, property, minValue, maxValue) {
    "use strict";
    var _element = new THREE.SimpleDatGuiControl(object, property, minValue, maxValue, this.parent, false, this.options);
    this.children.push(_element);
    return _element;
}

THREE.SimpleDatGuiControl.prototype.name = function(value) {
    "use strict";
    this.label = value;
    this.createLabel(this.label);
    return this;
}

THREE.SimpleDatGuiControl.prototype.executeCallback = function(event) {
    "use strict";
    if (this.isFunctionControl()) {
        this.onChangeCallback(null);
        return;
    }
    if (this.isCheckBoxControl()) {
        this.object[this.property] = !this.object[this.property];
        this.onChangeCallback(this.object[this.property]);
        return;
    }
    if (this.isTextControl()) {
        this.onChangeCallback(this.object[this.property]);
        return;
    }
    if (this.isSliderControl()) {
        this.onChangeCallback(this.object[this.property]);
        return;
    }
    if (this.isOnChangeExisting) {
        this.onChangeCallback(this.object[this.property]);
        return;
    }
    if (this.isElementFolder) {
        this.open();
    }
}

THREE.SimpleDatGuiControl.prototype.updateColor = function() {
    "use strict";
    var COLOR_SELECTED = '0x010101';

    var COLOR_SELECTED_TEXT = '0xFFFFFF';
    var COLOR_FOLDER = '0x010101';
    var COLOR_FOLDER_TEXT = '0xFFFFFF';
    var COLOR_BASE = '0x1a1a1a';
    var COLOR_BASE_CLOSE_BUTTON = '0x121212';
    var COLOR_BASE_TEXT = '0xFFFFFF';

    var COLOR_MARKER_BUTTON = '0xe61d5f';
    var COLOR_MARKER_CHECKBOX = '0x806787';
    var COLOR_MARKER_TEXT = '0x1ed36f';
    var COLOR_MARKER_NUMBER = '0x2fa1d6';

    if (this.parent.selected === this && ((this.isCheckBoxControl()) || (this.isFunctionControl()))) {
        this.wArea.material.color.setHex(COLOR_SELECTED);
        this.wLabel.material.color.setHex(COLOR_SELECTED_TEXT);
    } else {
        if (this.isElementFolder) {
            this.wArea.material.color.setHex(COLOR_FOLDER);
            this.wLabel.material.color.setHex(COLOR_FOLDER_TEXT);
        } else {
            this.wArea.material.color.setHex(COLOR_BASE);
            this.wLabel.material.color.setHex(COLOR_BASE_TEXT);
        }
    }

    if (!this.isElementFolder && this.isCheckBoxControl()) {
        this.wMarker.material.color.setHex(COLOR_MARKER_CHECKBOX);
    }

    if (!this.isElementFolder && this.isTextControl()) {
        this.wMarker.material.color.setHex(COLOR_MARKER_TEXT);
    }

    if (!this.isElementFolder && this.isSliderControl()) {
        this.wMarker.material.color.setHex(COLOR_MARKER_NUMBER);
        this.wValue.material.color.setHex(0x2fa1d6);
        this.wValueSliderBar.material.color.setHex(0x2fa1d6);
    }

    if (!this.isElementFolder && this.isFunctionControl()) {
        this.wMarker.material.color.setHex(COLOR_MARKER_BUTTON);
    }

    if (this.isElementFolder && this.isCloseButton) {
        if (this.parent.selected === this) {
            this.wMarker.material.color.setHex(COLOR_BASE_CLOSE_BUTTON);
            this.wArea.material.color.setHex(COLOR_BASE_CLOSE_BUTTON);
        } else {
            this.wMarker.material.color.setHex(COLOR_SELECTED);
            this.wArea.material.color.setHex(COLOR_SELECTED);
        }
    }

    if (this.isTextControl()) {
        this.wCursor.material.color.setHex(0xFFFF11);
        this.wTextValue.material.color.setHex(this.parent.focus === this ? 0xFFFFFF : 0x1ed36f);
    }

}

THREE.SimpleDatGuiControl.prototype.listen = function() {
    console.warn('The listen method is depricated.');
    return this;
}

THREE.SimpleDatGuiControl.prototype.listenInternal = function() {
    "use strict";
    var that = this;
    this.updateTimer = setInterval(function() {
        if (that.isSliderControl()) {
            if (that.lastValue !== that.object[that.property]) {
                var newValue = that.object[that.property];
                that.createValue(newValue);
                that.scaling = (newValue - that.minValue) / (that.maxValue - that.minValue);
                that.createValueSliderBar(that.scaling);
            }
            that.lastValue = that.object[that.property];
        }
        if (that.isTextControl()) {

            if (that.lastValue !== that.object[that.property]) {
                var newValue = that.object[that.property];
                that.textHelper.calculateAlignTextLastCall(newValue);
                that.createTextValue(that.textHelper.truncated);
            }
            that.lastValue = that.object[that.property];
        }
    }, 500);
    return this;
}

THREE.SimpleDatGuiControl.prototype.step = function(value) {
    "use strict";
    this.step = value;
    return this;
}

THREE.SimpleDatGuiControl.prototype.open = function() {
    "use strict";
    if (this.isElementFolder) {
        this.folderIsHidden = !this.folderIsHidden;
        this.updateChildrenHidden();
    }
    return this;
}

THREE.SimpleDatGuiControl.prototype.updateChildrenHidden = function() {
    "use strict";
    this.children.forEach(function(entry) {
        entry.isElementHidden = !entry.isElementHidden;
    });
}

THREE.SimpleDatGuiControl.prototype.isCheckBoxControl = function() {
    "use strict";
    return this.propertyType === 'boolean';
}

THREE.SimpleDatGuiControl.prototype.isTextControl = function() {
    "use strict";
    return this.propertyType === 'string';
}

THREE.SimpleDatGuiControl.prototype.isSliderControl = function() {
    "use strict";
    return this.propertyType === 'number';
}

THREE.SimpleDatGuiControl.prototype.isFunctionControl = function() {
    "use strict";
    return this.propertyType === 'function';
}

THREE.SimpleDatGuiControl.prototype.isVisible = function() {
    "use strict";
    return !this.isElementHidden;
}

// ////////////////////////////////////////////////////////////////////////////////////

THREE.SimpleDatGuiTextHelper = function(options) {
    "use strict";

    this.options = options;
    this.start = 0;
    this.end = 0;
    this.cursor = 0;
    this.truncated = false;
    this.residiumX = 0.0;
    this.isLastCallLeft = false;
    this.isTruncated = false;
}

THREE.SimpleDatGuiTextHelper.prototype.calculateRightAlignText = function(value) {
    "use strict";

    // Start with the complete string
    this.isTruncated = false;
    this.truncated = value;
    this.residiumX = 0;
    this.end = value.length - 1;

    var fontshapesAll = THREE.FontUtils.generateShapes(value, {
        size: this.options.FONT_SIZE
    });
    var size = this.options.TEXT_FIELD_SIZE.x;
    for (var i = fontshapesAll.length - 1; i > 1; i--) {
        var boundingBox2 = fontshapesAll[i].getBoundingBox();
        var boundingBox1 = fontshapesAll[i - 1].getBoundingBox();
        var charWidth = boundingBox2.maxX - boundingBox1.maxX;
        size -= charWidth;
        if (size <= 12 && !this.isTruncated) {
            this.isTruncated = true;
            this.start = i - 2;
            this.truncated = value.substring(this.start, this.end + 1);
        }
    }

    var fontshapesTruncated = THREE.FontUtils.generateShapes(this.truncated, {
        size: this.options.FONT_SIZE
    });
    if (fontshapesTruncated.length > 0) {
        this.residiumX = this.options.TEXT_FIELD_SIZE.x
                    - fontshapesTruncated[fontshapesTruncated.length - 1].getBoundingBox().maxX;
    } else {
        this.residiumX = 0;
    }

    this.isLastCallLeft = false;

    return this;
}

THREE.SimpleDatGuiTextHelper.prototype.calculateLeftAlignText = function(value) {
    "use strict";

    // Start with the complete string
    this.isTruncated = false;
    this.truncated = value;
    this.residiumX = 0;

    var fontshapesAll = THREE.FontUtils.generateShapes(value, {
        size: this.options.FONT_SIZE
    });
    for (var i = 0; i < fontshapesAll.length - 1; i++) {
        var boundingBox1 = fontshapesAll[i].getBoundingBox();
        if ((this.options.TEXT_FIELD_SIZE.x - boundingBox1.maxX) < 12 && !this.isTruncated) {
            this.isTruncated = true;
            this.end = i;
            this.truncated = value.substring(this.start, this.end);
        }
    }

    this.isLastCallLeft = true;

    return this;
}

THREE.SimpleDatGuiTextHelper.prototype.calculateAlignTextLastCall = function(value) {

    if (!this.isTruncated) { return this.calculateLeftAlignText(value); }

    if (this.cursor <= this.start) {
        this.isLastCallLeft = true;
    }

    if (this.cursor > this.end) {
        this.isLastCallLeft = false;
    }

    if (this.isLastCallLeft) {
        return this.calculateLeftAlignText(value);
    } else {
        return this.calculateRightAlignText(value);
    }
}