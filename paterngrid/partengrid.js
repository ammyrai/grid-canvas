
var B64Coder = {
    toChar: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_",
    fromChar: {},
    init: function() {
        for (var a = 0; a < 64; a++) {
            this.fromChar[this.toChar.charAt(a)] = a
        }
    },
    encodeNumber: function(g, e) {
        var d = "";
        for (var a = 0; a < e; a += 6) {
            var f = this.toChar.charAt(g & 63);
            d = d + f;
            g = g >> 6
        }
        return d
    },
    decodeNumberS: function(f, g) {
        var j = 0;
        var d = 1;
        var e = 0;
        for (var a = 0; a < g; a += 6) {
            var h = f.charAt(e++);
            j = j + this.fromChar[h] * d;
            d = d << 6
        }
        if (j & (1 << (a - 1))) {
            j = j | (-1 << a)
        }
        return j
    },
    decodeNumberU: function(f, g) {
        var j = 0;
        var d = 1;
        var e = 0;
        for (var a = 0; a < g; a += 6) {
            var h = f.charAt(e++);
            j = j + this.fromChar[h] * d;
            d = d << 6
        }
        return j
    },
};
B64Coder.init();

function StringDecoder(a) {
    this.i = 0;
    this.str = a;
    this.getNumS = function(c) {
        var b = B64Coder.decodeNumberS(this.str.slice(this.i, this.i + c), c * 6);
        this.i += c;
        return b
    };
    this.getNumU = function(c) {
        var b = B64Coder.decodeNumberU(this.str.slice(this.i, this.i + c), c * 6);
        this.i += c;
        return b
    };
    this.getStr = function(b) {
        var c = this.str.slice(this.i, this.i + b);
        this.i += b;
        return c
    };
    this.checkEnd = function() {}
}

function B64StreamCoder() {
    this.str = "";
    this.strPos = 0;
    this.bits = 0;
    this.bitCount = 0;
    this.startDecode = function(a) {
        this.str = a;
        this.strPos = 0;
        this.bits = 0;
        this.bitCount = 0
    };
    this.startEncode = function() {
        this.str = "";
        this.strPos = 0;
        this.bits = 0;
        this.bitCount = 0
    };
    this.get = function(d) {
        while (this.bitCount < d) {
            var a = B64Coder.fromChar[this.str[this.strPos++]];
            this.bits |= a << this.bitCount;
            this.bitCount += 6
        }
        var c = this.bits & ((1 << d) - 1);
        this.bits = this.bits >> d;
        this.bitCount -= d;
        return c
    };
    this.put = function(d, c) {
        if (c > 24) {
            this.put(d & 65535, 16);
            this.put(d >> 16, c - 16);
            return
        }
        this.bits |= d << this.bitCount;
        this.bitCount += c;
        while (this.bitCount >= 6) {
            var a = this.bits & 63;
            this.str += B64Coder.toChar.charAt(a);
            this.bits = this.bits >> 6;
            this.bitCount -= 6
        }
    };
    this.finishEncode = function() {
        if (this.bitCount > 0) {
            var a = this.bits & 63;
            this.str += B64Coder.toChar.charAt(a);
            this.bits = 0;
            this.bitCount = 0
        }
        return this.str
    }
}
var DesIO = {
    handlers: {},
    codes: new Array,
    loadNotifiers: [],
    register: function(b, a, c) {
        if (b.length != 2) {
            throw "DesIO code must be 2 chars, not " + b
        }
        if (this.handlers[b] && (this.handlers[b].from != a || this.handlers[b].to != c)) {
            throw "DesIO code " + b + " registered with different handlers"
        }
        this.handlers[b] = {
            code: b,
            from: a,
            to: c
        };
        this.codes.push(b)
    },
    unregister: function(a) {
        this.handlers[a] = null
    },
    addLoadNotify: function(b, a) {
        this.loadNotifiers.push({
            callback: b,
            data: a
        })
    },
    load: function(a) {
        if (typeof(Storage) === "undefined") {
            return
        }
        try {
            var c = localStorage[a];
            if (c) {
                this.loadFromStr(a, c, true);
                AutoSave.cancel();
                UndoRedo.reset(c)
            }
        } catch (b) {}
    },
    loadFromStr: function(a, j, l) {
        if (!j) {
            return
        }
        var e = 0;
        if (j.slice(e, e + a.length) != a) {
            alert("invalid saved data " + j);
            localStorage[a] = "";
            return
        }
        e += a.length;
        var o = {};
        for (var f in this.handlers) {
            o[this.handlers[f].code] = false
        }
        while (e < j.length) {
            var b = j.slice(e, e + 2);
            e += 2;
            var g = B64Coder.decodeNumberU(j.slice(e, e + 4), 24);
            e += 4;
            var d = j.slice(e, e + g);
            e += g;
            var m = this.handlers[b];
            if (m && m.from) {
                m.from(d, l);
                o[m.code] = true
            } else {
                alert("invalid saved data section " + b);
                localStorage[a] = "";
                break
            }
        }
        for (var f in this.handlers) {
            if (o[this.handlers[f].code] == false && this.handlers[f].from) {
                this.handlers[f].from("", l)
            }
        }
        for (var c in this.loadNotifiers) {
            var k = this.loadNotifiers[c];
            k.callback(k.data)
        }
    },
    saveFailAlerted: false,
    save: function(b, a) {
        if (typeof(Storage) === "undefined") {
            if (!this.saveFailAlerted) {
                alert("Warning, browser does not support saving your work")
            }
            this.saveFailAlerted = true;
            return
        }
        var c = this.getState(b);
        this.saveStr(b, c);
        UndoRedo.addState(c, a)
    },
    getState: function(a, e) {
        var l = 1 + Object.keys(this.handlers).length * 3;
        var f = new Array(l);
        var b = 0;
        f[b++] = a;
        for (var j = 0; j < this.codes.length; j++) {
            var d = this.codes[j];
            if (e && e.indexOf(d) != -1) {
                continue
            }
            var k = this.handlers[d];
            if (!k) {
                continue
            }
            var g = k.to();
            f[b++] = d;
            f[b++] = B64Coder.encodeNumber(g.length, 24);
            f[b++] = g
        }
        var h = f.join("");
        return h
    },
    saveStr: function(a, c) {
        try {
            localStorage[a] = c
        } catch (b) {
            if (!this.saveFailAlerted) {
                alert("Warning, browser does not support saving your work, reason: " + b.toString())
            }
            this.saveFailAlerted = true
        }
    },
    remove: function(a) {
        if (typeof(Storage) === "undefined") {
            return
        }
        localStorage[a] = ""
    }
};
var AutoSave = {
    timer: null,
    active: false,
    paused: false,
    pending: false,
    quiet: true,
    save: function(a) {
        if (!a) {
            this.quiet = false
        }
        if (this.paused) {
            this.pending = true
        } else {
            clearTimeout(this.timer);
            this.timer = setTimeout(this.timeout, 1000);
            var b = this.active;
            this.active = true;
            if (!b) {
                UndoRedo.newStateInProgress()
            }
        }
    },
    timeout: function() {
        var a = AutoSave.active;
        AutoSave.active = false;
        AutoSave.pending = false;
        if (a) {
            DesIO.save(AppData.name, AutoSave.quiet);
            AutoSave.quiet = true
        }
    },
    immediate: function() {
        if (this.active) {
            clearTimeout(this.timer);
            this.timeout()
        }
    },
    cancel: function() {
        clearTimeout(this.timer);
        this.active = false
    },
    pause: function() {
        this.paused = true;
        clearTimeout(this.timer)
    },
    restart: function() {
        this.paused = false;
        if (this.pending) {
            this.pending = false;
            this.save()
        }
    },
};

function NumberField(a, c, b) {
    this.selector = a;
    this.updateCallback = c;
    this.updateTimeout = b;
    this.min = Number($(this.selector).attr("min"));
    this.max = Number($(this.selector).attr("max"));
    $(this.selector).keyup({
        nf: this
    }, function(d) {
        var e = Number($(this).val());
        d.data.nf.formValueChanged(e)
    });
    $(this.selector).change({
        nf: this
    }, function(d) {
        var e = Number($(this).val());
        d.data.nf.formValueChanged(e)
    });
    this.formValueChangedTimer = null;
    this.lastNotified = null;
    this.notifyChange = function(d) {
        if (d == this.lastNotified) {
            return
        }
        this.lastNotified = d;
        clearTimeout(this.formValueChangedTimer);
        this.updateCallback(d)
    };
    this.immediate = function() {
        this.notifyChange(Math.min(Math.max(this.min, Number(this.value())), this.max))
    };
    this.formValueChanged = function(e) {
        if (e == "") {
            return
        }
        if (isNaN(e)) {
            this.intSetValue(this.lastSet);
            $(this.selector).select();
            return
        } else {
            if (e == 0) {
                e = this.min;
                this.intSetValue(e);
                $(this.selector).select()
            } else {
                if (e < this.min) {
                    return
                } else {
                    if (e > this.max) {
                        e = this.max;
                        this.intSetValue(e);
                        $(this.selector).select()
                    }
                }
            }
        }
        this.lastSet = e;
        clearTimeout(this.formValueChangedTimer);
        var d = this;
        this.formValueChangedTimer = setTimeout(function() {
            d.notifyChange(e)
        }, this.updateTimeout)
    };
    this.intSetValue = function(d) {
        if (this.value() != d) {
            $(this.selector).val(d)
        }
        this.lastSet = d
    };
    this.setValue = function(d) {
        this.intSetValue(d);
        this.lastNotified = d;
        clearTimeout(this.formValueChangedTimer)
    };
    this.value = function() {
        return $(this.selector).val()
    };
    this.setMax = function(d) {
        this.max = d;
        if (this.value() > d) {
            this.setValue(d)
        }
    };
    this.setMin = function(d) {
        this.min = d;
        if (this.value() < d) {
            this.setValue(d)
        }
    }
}

function EventCapturer(a) {
    this.callbackSet = null;
    this.doc = $(document);
    this.start = function(d, c) {
        var e = d;
        var f = c ? c : d;
        if (this.callbackSet) {
            this.end()
        }
        this.callbackSet = f;
        if (c) {
            this.doc.bind(a, e, f)
        } else {
            this.doc.bind(a, f)
        }
    };
    this.end = function() {
        this.doc.unbind(a, this.callbackSet);
        this.callbackSet = null
    };
    this.active = function() {
        return this.callbackSet != null
    }
}
MouseUpCapture = new EventCapturer("mouseup");
MouseMoveCapture = new EventCapturer("mousemove");
TouchEndCapture = new EventCapturer("touchend");
TouchMoveCapture = new EventCapturer("touchmove");
TouchCancelCapture = new EventCapturer("touchcancel");
UndoRedo = {
    limit: 11,
    pos: 0,
    stack: new Array(),
    settingState: false,
    reset: function(a) {
        this.stack = new Array();
        this.pos = 0;
        this.addState(a, false)
    },
    addState: function(b, a) {
        if (this.pos > 0 && this.stack[this.pos - 1].data == b) {
            this.pos--;
            return
        }
        if (this.pos > 0 && this.stack[this.pos - 1].replaceable) {
            this.pos--
        }
        this.stack[this.pos] = {
            data: b,
            replaceable: a
        };
        this.setButtons()
    },
    newStateInProgress: function() {
        if (this.settingState) {
            return
        }
        var a = this.stack.length > this.pos + 1;
        while (this.stack.length > this.pos + 1) {
            this.stack.pop()
        }
        if (this.pos == 0) {
            a = true
        }
        this.pos = this.stack.length;
        while (this.pos >= this.limit) {
            this.stack.shift();
            this.pos--
        }
        if (a) {
            this.setButtons()
        }
    },
    undoClicked: function() {
        AutoSave.immediate();
        if (this.pos > 0) {
            this.pos--;
            this.setStateHere()
        }
        this.setButtons()
    },
    redoClicked: function() {
        AutoSave.cancel();
        if (this.pos < this.stack.length - 1) {
            this.pos++;
            this.setStateHere()
        }
        this.setButtons()
    },
    setStateHere: function() {
        this.settingState = true;
        var a = this.stack[this.pos].data;
        DesIO.loadFromStr(AppData.name, a, false);
        DesIO.saveStr(AppData.name, a);
        this.settingState = false
    },
    setButtons: function() {
        this.enableButton(".undoButton", this.pos > 0);
        this.enableButton(".redoButton", this.pos < this.stack.length - 1)
    },
    enableButton: function(b, a) {
        if (a) {
            $(b).removeClass("disabledAction")
        } else {
            $(b).addClass("disabledAction")
        }
    },
};

function scaleImageData(l, a, e) {
    var f = l.createImageData(a.width * e, a.height * e);
    for (var m = 0; m < a.height; m++) {
        for (var d = 0; d < a.width; d++) {
            var b = [a.data[(m * a.width + d) * 4 + 0], a.data[(m * a.width + d) * 4 + 1], a.data[(m * a.width + d) * 4 + 2], a.data[(m * a.width + d) * 4 + 3]];
            for (var h = 0; h < e; h++) {
                var k = m * e + h;
                for (var j = 0; j < e; j++) {
                    var c = d * e + j;
                    for (var g = 0; g < 4; g++) {
                        f.data[(k * f.width + c) * 4 + g] = b[g]
                    }
                }
            }
        }
    }
    return f
}

function rgb2css(e, d, a) {
    var c = 16777216 + (e << 16) + (d << 8) + a;
    return "#" + c.toString(16).substr(1)
}

function CdoColour(a, d, l) {
    this.r = a;
    this.g = d;
    this.b = l;
    if (d == undefined || l == undefined) {
        var h = a;
        if (h[0] != "#") {
            h = colourSource.colourById(h)
        }
        if (h.length != 7) {
            throw "bad Colour init"
        }
        this.r = parseInt(h.substring(1, 3), 16);
        this.g = parseInt(h.substring(3, 5), 16);
        this.b = parseInt(h.substring(5, 7), 16)
    }
    var n = this.r / 255;
    var c = this.g / 255;
    var j = this.b / 255;
    var o = function(b) {
        if (b > 0.04045) {
            return Math.pow((b + 0.055) / 1.055, 2.4)
        } else {
            return b / 12.92
        }
    };
    n = o(n);
    c = o(c);
    j = o(j);
    this.xyz_x = n * 0.4124 + c * 0.3576 + j * 0.1805;
    this.xyz_y = n * 0.2126 + c * 0.7152 + j * 0.0722;
    this.xyz_z = n * 0.0193 + c * 0.1192 + j * 0.9505;
    var k = this.xyz_x / 0.95047;
    var f = this.xyz_y;
    var e = this.xyz_z / 1.08883;
    var m = function(b) {
        if (b > 0.008856) {
            return Math.pow(b, 1 / 3)
        } else {
            return 7.787 * b + 4 / 29
        }
    };
    k = m(k);
    f = m(f);
    e = m(e);
    this.lab_l = 116 * f - 16;
    this.lab_a = 500 * (k - f);
    this.lab_b = 200 * (f - e);
    this.lab_c = Math.sqrt(this.lab_a * this.lab_a + this.lab_b * this.lab_b);
    this.toString = function() {
        return rgb2css(this.r, this.g, this.b)
    };
    this.linearDist = function(b) {
        return Math.abs(this.r - b.r) + Math.abs(this.g - b.g) + Math.abs(this.b - b.b)
    };
    this.squareDist = function(g) {
        var q = this.r - g.r;
        var p = this.g - g.g;
        var b = this.b - g.b;
        return Math.sqrt(q * q + p * p + b * b)
    };
    this.cielab94Dist = function(r) {
        var b = this.lab_c - r.lab_c;
        var q = this.lab_l - r.lab_l;
        var p = this.lab_a - r.lab_a;
        var g = this.lab_b - r.lab_b;
        var t = Math.sqrt(Math.abs((p * p) + (g * g) - (b * b)));
        var u = b / (1 + 0.045 * this.lab_c);
        var s = t / (1 + 0.015 * this.lab_c);
        return (Math.sqrt(q * q + u * u + s * s))
    };
    this.dist = this.cielab94Dist
}
cdoToolTip = {
    shown: false,
    show: function(b, f) {
        var d = $("#cdoToolTip");
        d.removeClass("hideMe");
        d.css("left", b.clientX + 15);
        d.css("top", b.clientY + 15);
        var c = $("#cdoToolTip p");
        if (f != c.text()) {
            var e = d.width();
            d.stop(true, false);
            d.css("width", "");
            c.text(f);
            if (this.shown) {
                var a = d.width();
                if (a < e) {
                    d.css("width", e);
                    d.animate({
                        width: a
                    }, 200)
                }
            }
        }
        this.shown = true
    },
    hide: function() {
        var a = $("#cdoToolTip");
        a.addClass("hideMe");
        this.shown = false
    },
};

function clone(d) {
    if (d && "object" == typeof d) {
        if (jQuery.isArray(d)) {
            var b = new Array(d.length);
            for (var c in d) {
                b[c] = clone(d[c])
            }
            return b
        } else {
            var e = {};
            for (var b in d) {
                e[b] = clone(d[b])
            }
            return e
        }
    } else {
        return d
    }
}

function TrackMin(a, b) {
    this.id = clone(a);
    this.val = b;
    this.update = function(d, c) {
        if (c < this.val) {
            this.id = clone(d);
            this.val = c;
            return true
        }
        return false
    }
}

function TrackMax(a, b) {
    this.id = clone(a);
    this.val = b;
    this.update = function(d, c) {
        if (c > this.val) {
            this.id = clone(d);
            this.val = c;
            return true
        }
        return false
    }
}

function Draggable(b, a) {
    this.jq = b;
    this.handler = a;
    this.lastX = 0;
    this.lastY = 0;
    this.startX = 0;
    this.startY = 0;
    this.mousedown = false;
    this.MOUSE = 0;
    this.TOUCH = 1;
    this.eventType = this.MOUSE;
    this.extractTouch = function(c) {
        c.clientX = this.lastX;
        c.clientY = this.lastY;
        if (c.originalEvent.touches && c.originalEvent.touches[0]) {
            for (var d in c.originalEvent.touches) {
                var e = Number(d);
                if (!isNaN(e) && e != 0) {
                    c.multi = true
                }
            }
            c.clientX = c.originalEvent.touches[0].clientX;
            c.clientY = c.originalEvent.touches[0].clientY
        }
    };
    this.handleMouseDown = function(c) {
        this.eventType = this.MOUSE;
        this.mouseDown(c)
    };
    this.handleTouchDown = function(c) {
        this.eventType = this.TOUCH;
        this.extractTouch(c);
        this.mouseDown(c)
    };
    this.mouseDown = function(c) {
        this.lastX = this.startX = c.clientX;
        this.lastY = this.startY = c.clientY;
        this.mousedown = true;
        if (this.eventType == this.MOUSE) {
            c.preventDefault()
        }
        MouseUpCapture.start({
            drag: this
        }, function(d) {
            d.data.drag.handleMouseUp(d)
        });
        MouseMoveCapture.start({
            drag: this
        }, function(d) {
            d.data.drag.handleMouseMove(d)
        });
        TouchEndCapture.start({
            drag: this
        }, function(d) {
            d.data.drag.handleTouchUp(d)
        });
        TouchMoveCapture.start({
            drag: this
        }, function(d) {
            d.data.drag.handleTouchMove(d)
        });
        if (this.handler.dragStart && c.clientX) {
            this.handler.dragStart(c)
        }
    };
    this.handleMouseMove = function(c) {
        if (this.eventType == this.MOUSE) {
            this.mouseMove(c)
        }
    };
    this.handleTouchMove = function(c) {
        if (this.eventType == this.TOUCH) {
            this.extractTouch(c);
            this.mouseMove(c)
        }
    };
    this.mouseMove = function(c) {
        if (!this.mousedown && !this.handler.dragOver) {
            return
        }
        if (c.multi) {
            return
        }
        c.preventDefault();
        if (!this.lastX || !this.lastY) {
            this.lastX = c.clientX;
            this.lastY = c.clientY
        }
        if (!this.startX || !this.startY) {
            this.startX = c.clientX;
            this.startY = c.clientY
        }
        if (c.clientX) {
            if (this.mousedown && this.handler.dragMove) {
                this.handler.dragMove(c)
            } else {
                if (!this.mousedown && this.handler.dragOver) {
                    this.handler.dragOver(c)
                }
            }
        }
        this.lastX = c.clientX;
        this.lastY = c.clientY
    };
    this.handleMouseUp = function(c) {
        if (this.eventType == this.MOUSE) {
            this.mouseUp(c)
        }
    };
    this.handleTouchUp = function(c) {
        if (this.eventType == this.TOUCH) {
            this.extractTouch(c);
            this.mouseUp(c)
        }
    };
    this.mouseUp = function(c) {
        this.stop();
        if (this.eventType == this.MOUSE) {
            c.preventDefault()
        }
        if (c.clientX != undefined && c.clientY != undefined && (this.lastX != c.clientX || this.lastY != c.clientY)) {
            this.lastX = c.clientX;
            this.lastY = c.clientY;
            if (this.handler.dragMove) {
                this.handler.dragMove(c)
            }
        }
        if (this.handler.dragEnd) {
            this.handler.dragEnd(c)
        }
        this.lastX = null;
        this.lastY = null
    };
    this.jq.mousedown({
        drag: this
    }, function(c) {
        c.data.drag.handleMouseDown(c)
    });
    this.jq.on("touchstart", {
        drag: this
    }, function(c) {
        c.data.drag.handleTouchDown(c)
    });
    this.jq.mousemove({
        drag: this
    }, function(c) {
        c.data.drag.handleMouseMove(c)
    });
    this.jq.on("touchmove", {
        drag: this
    }, function(c) {
        c.data.drag.handleTouchMove(c)
    });
    this.stop = function() {
        this.mousedown = false;
        MouseUpCapture.end();
        MouseMoveCapture.end();
        TouchEndCapture.end();
        TouchMoveCapture.end()
    }
}
userSettings = {
    settings: {},
    load: function() {
        if (typeof(Storage) === "undefined") {
            return
        }
        try {
            var h = localStorage.patternGridSettings;
            if (h) {
                this.settings = {};
                var f = h.split("&");
                for (var b in f) {
                    var e = f[b].split("=");
                    var a = unescape(e[0]);
                    var g = unescape(e[1]);
                    var c = unescape(e[2]);
                    if (c == "number") {
                        g = Number(g)
                    } else {
                        if (c == "boolean") {
                            g = (g == "true")
                        }
                    }
                    this.settings[a] = g
                }
            }
        } catch (d) {}
    },
    save: function() {
        try {
            var d = [];
            for (var a in this.settings) {
                var f = this.settings[a];
                var c = escape(a.toString()) + "=" + escape(f.toString()) + "=" + (typeof f);
                d.push(c)
            }
            var e = d.join("&");
            localStorage.patternGridSettings = e
        } catch (b) {
            if (!this.saveFailAlerted) {
                alert("Warning, browser does not support saving your settings, reason: " + b.toString())
            }
            this.saveFailAlerted = true
        }
    },
    get: function(a, b) {
        var c = this.settings[a];
        if (c == undefined) {
            return b
        } else {
            return c
        }
    },
    set: function(b, c) {
        var a = typeof(c);
        if (a != "boolean" && a != "number" && a != "string") {
            throw "unsupported setting type"
        }
        this.settings[b] = c;
        this.save()
    },
};
userSettings.load();
CanvasRenderingContext2D.prototype.patternedLine = function(g, e, h, f, b, c) {
    var k = h - g;
    var j = f - e;
    var d = Math.max(Math.abs(k), Math.abs(j));
    d = Math.round(d / b);
    k /= d;
    j /= d;
    for (var a = 0; a < d; a++) {
        this.beginPath();
        this.moveTo(g, e);
        g += k;
        e += j;
        this.strokeStyle = c[a % c.length];
        this.lineTo(g, e);
        this.stroke()
    }
};
ZOrderManager = {
    current: null,
    focus: function(a) {
        if (a != this.current) {
            this.drop(this.current)
        }
        if (a) {
            a.css("z-index", 101)
        }
        this.current = a
    },
    hide: function(a) {
        if (a) {
            a.css("z-index", -1)
        }
        if (a == this.current) {
            this.current = null
        }
    },
    drop: function(a) {
        if (a) {
            a.css("z-index", 100)
        }
        if (a == this.current) {
            this.current = null
        }
    },
};
var colourSource = {
    uiName: null,
    impl: null,
    id: "#ff0000",
    sources: [],
    codeMap: {},
    init: function() {
        DesIO.register("CS", function(b) {
            colourSource.fromString(b)
        }, function() {
            return colourSource.toString()
        });
        var a = $(".colourSource");
        a.each(function(d, f) {
            var b = $(f).attr("object");
            var c = window[b];
            colourSource.sources[d] = c;
            colourSource.codeMap[c.code] = c;
            c.init();
            var g = $(f).attr("name");
            $("#colourSourceSelect").append($("<option>", {
                value: f.id
            }).text(g))
        });
        this.setUi("farbtasticPicker");
        $("#colourSourceSelect").change(function() {
            var b = $("#colourSourceSelect").val();
            colourSource.setUi(b);
            AutoSave.save("quiet")
        })
    },
    toString: function() {
        var c = new Array(7);
        var b = 0;
        var a = 0;
        c[b++] = B64Coder.encodeNumber(a, 12);
        c[b++] = B64Coder.encodeNumber(this.uiName.length, 12);
        c[b++] = this.uiName;
        var d = c.join("");
        return d
    },
    fromString: function(b) {
        if (!b) {
            return
        }
        var d = new StringDecoder(b);
        d.getNumU(2);
        var a = d.getNumU(2);
        var c = d.getStr(a);
        d.checkEnd();
        if (c.length) {
            this.setUi(c)
        }
    },
    setUi: function(b) {
        if (this.uiName == b) {
            return
        }
        $(".colourSource").addClass("hideMe");
        this.current = $("#" + b);
        this.current.removeClass("hideMe");
        var a = this.current.attr("object");
        this.impl = window[a];
        this.impl.activate();
        $("#colourSourceSelect").val(b);
        this.uiName = b;
        this.showId(this.id)
    },
    obs: [],
    linkTo: function(a) {
        this.obs.push(a)
    },
    notify: function(b) {
        for (var a in this.obs) {
            this.obs[a](b)
        }
    },
    setColour: function(a) {
        this.setId(this.idByColour(a))
    },
    setId: function(a) {
        this.showId(a);
        this.notify(a)
    },
    showId: function(b) {
        this.id = b;
        var a = this.implById(b);
        if (this.impl == a) {
            this.impl.showId(b, b)
        } else {
            this.impl.showId(this.impl.toId(a.fromId(b)), b)
        }
    },
    colourById: function(b) {
        var a = this.implById(b);
        return a.fromId(b)
    },
    nameById: function(b) {
        var a = this.implById(b);
        return a.idName(b)
    },
    idByColour: function(a) {
        return this.impl.toId(a)
    },
    implById: function(b) {
        var a = b.substr(0, 1);
        return this.codeMap[a]
    },
    threshold: function(a) {
        if (a) {
            return this.implById(a).threshold
        } else {
            return this.impl.threshold
        }
    },
    extractId: function(b) {
        var a = b.length;
        while (b[a - 1] == "_") {
            a--
        }
        return b.substr(0, a)
    },
    formatId: function(a) {
        while (a.length < 7) {
            a += "_"
        }
        return a
    },
    numColours: function() {
        return this.impl.numColours
    },
    idByIndex: function(a) {
        return this.impl.fromIndex(a)
    },
    strongChoice: function() {
        return this.impl.strongChoice
    },
};
var farbtasticColourSource = {
    code: "#",
    fb: null,
    doNotify: true,
    threshold: 2.5,
    numColours: 256 * 256 * 256,
    strongChoice: false,
    init: function() {
        this.fb = $.farbtastic("#farbtasticPicker");
        this.fb.linkTo(function() {
            farbtasticColourSource.fbColourPick(this.color)
        })
    },
    fromId: function(a) {
        return a
    },
    toId: function(a) {
        return a
    },
    idName: function(a) {
        return generalColourList.nearest(a).colName
    },
    showId: function(b, a) {
        this.doNotify = false;
        this.fb.setColor(this.fromId(b));
        this.doNotify = true
    },
    activate: function() {},
    fbColourPick: function(a) {
        var b = this.toId(a);
        colourSource.id = b;
        if (this.doNotify) {
            colourSource.notify(b)
        }
    },
    fromIndex: function(a) {
        return rgb2css(a >> 16, (a >> 8) & 255, a & 255)
    },
};

function GeneralColour(a, b) {
    this.id = b;
    this.name = a;
    this.colName = a;
    this.colour = b;
    this.cdoColour = new CdoColour(b)
}
generalColourList = {
    init: function() {
        this.colours = {};
        for (var a in this.table) {
            var d = this.table[a];
            if (d.length >= 2) {
                var b = d[0];
                var c = d[1];
                this.colours[c] = new GeneralColour(b, c)
            }
        }
    },
    lookup: function(a) {
        return this.colours[a]
    },
    nearest: function(e) {
        var b = new CdoColour(e);
        var a = null;
        var g = 1000000;
        for (var h in this.colours) {
            var d = this.colours[h];
            var f = b.dist(d.cdoColour);
            if (f < g) {
                g = f;
                a = d
            }
        }
        return a
    },
    table: [
        ["Rackley", "#5D8AA8"],
        ["Air superiority blue", "#72A0C1"],
        ["Aero blue", "#C9FFE5"],
        ["Alice blue", "#F0F8FF"],
        ["Almond", "#EFDECD"],
        ["Amaranth", "#E52B50"],
        ["Amazon", "#3B7A57"],
        ["Amethyst", "#9966CC"],
        ["Android Green", "#A4C639"],
        ["Antique brass", "#CD9575"],
        ["Antique bronze", "#665D1E"],
        ["Antique fuchsia", "#915C83"],
        ["Antique ruby", "#841B2D"],
        ["Moccasin", "#FAEBD7"],
        ["Apple green", "#8DB600"],
        ["Apricot", "#FBCEB1"],
        ["Electric cyan", "#00FFFF"],
        ["Aquamarine", "#7FFFD4"],
        ["Army green", "#4B5320"],
        ["Ash grey", "#B2BEB5"],
        ["Asparagus", "#87A96B"],
        ["Pink-orange", "#FF9966"],
        ["Red-brown", "#A52A2A"],
        ["AuroMetalSaurus", "#6E7F80"],
        ["Avocado", "#568203"],
        ["Azure", "#007FFF"],
        ["Azure mist", "#F0FFFF"],
        ["Tea rose", "#F4C2C2"],
        ["Banana yellow", "#FFE135"],
        ["Barn red", "#7C0A02"],
        ["Old silver", "#848482"],
        ["Bazaar", "#98777B"],
        ["Pale aqua", "#BCD4E6"],
        ["Beaver", "#9F8170"],
        ["Beige", "#F5F5DC"],
        ["Bdazzled Blue", "#2E5894"],
        ["Big dip o�ruby", "#9C2542"],
        ["Bistre", "#3D2B1F"],
        ["Sandy taupe", "#967117"],
        ["Black", "#000000"],
        ["Black bean", "#3D0C02"],
        ["Black leather jacket", "#253529"],
        ["Black olive", "#3B3C36"],
        ["Blanched Almond", "#FFEBCD"],
        ["Blast-off bronze", "#A57164"],
        ["Bleu de France", "#318CE7"],
        ["Blizzard Blue", "#ACE5EE"],
        ["Blond", "#FAF0BE"],
        ["Blue", "#0000FF"],
        ["Blue (NCS)", "#0087BD"],
        ["Blue (RYB)", "#0247FE"],
        ["Blue Bell", "#A2A2D0"],
        ["Blue-gray", "#6699CC"],
        ["Blue-green", "#0D98BA"],
        ["Blue sapphire", "#126180"],
        ["Blue-violet", "#8A2BE2"],
        ["Blueberry", "#4F86F7"],
        ["Blush", "#DE5D83"],
        ["Medium Tuscan red", "#79443B"],
        ["Bondi blue", "#0095B6"],
        ["Bone", "#E3DAC9"],
        ["Bottle green", "#006A4E"],
        ["Boysenberry", "#873260"],
        ["Brandeis blue", "#0070FF"],
        ["Brass", "#B5A642"],
        ["Brick red", "#CB4154"],
        ["Bright cerulean", "#1DACD6"],
        ["Bright green", "#66FF00"],
        ["Bright lavender", "#BF94E4"],
        ["Rose", "#FF007F"],
        ["Bright turquoise", "#08E8DE"],
        ["Electric lavender", "#F4BBFF"],
        ["Magenta", "#FF55A3"],
        ["Brink pink", "#FB607F"],
        ["British racing green", "#004225"],
        ["Bronze Yellow", "#737000"],
        ["Brown", "#964B00"],
        ["English green", "#1B4D3E"],
        ["Bulgarian rose", "#480607"],
        ["Burgundy", "#800020"],
        ["Burnt orange", "#CC5500"],
        ["Light red ochre", "#E97451"],
        ["Byzantine", "#BD33A4"],
        ["Byzantium", "#702963"],
        ["Cadet", "#536872"],
        ["Cadet blue", "#5F9EA0"],
        ["Cadet grey", "#91A3B0"],
        ["Cadmium green", "#006B3C"],
        ["Cadmium orange", "#ED872D"],
        ["Cadmium red", "#E30022"],
        ["Tuscan tan", "#A67B5B"],
        ["Caf� noir", "#4B3621"],
        ["Cal Poly green", "#1E4D2B"],
        ["Cambridge Blue", "#A3C1AD"],
        ["Wood brown", "#C19A6B"],
        ["Cameo pink", "#EFBBCC"],
        ["Camouflage green", "#78866B"],
        ["Deep sky blue", "#00BFFF"],
        ["Caput mortuum", "#592720"],
        ["Caribbean green", "#00CC99"],
        ["Carmine pink", "#EB4C42"],
        ["Carmine red", "#FF0038"],
        ["Carnation pink", "#FFA6C9"],
        ["Carolina blue", "#99BADD"],
        ["Carrot orange", "#ED9121"],
        ["Sacramento State green", "#00563F"],
        ["Catalina blue", "#062A78"],
        ["Ceil", "#92A1CF"],
        ["Cerulean", "#007BA7"],
        ["Celadon Green", "#2F847C"],
        ["Celeste", "#B2FFFF"],
        ["Celestial blue", "#4997D0"],
        ["Cerise pink", "#EC3B83"],
        ["Cerulean frost", "#6D9BC3"],
        ["Charcoal", "#36454F"],
        ["Charleston green", "#232B2B"],
        ["Light Thulian pink", "#E68FAC"],
        ["Cherry blossom pink", "#FFB7C5"],
        ["Chestnut", "#954535"],
        ["Thulian pink", "#DE6FA1"],
        ["China rose", "#A8516E"],
        ["Chinese red", "#AA381E"],
        ["Chocolate", "#7B3F00"],
        ["Cocoa brown", "#D2691E"],
        ["Chrome yellow", "#FFA700"],
        ["Cinereous", "#98817B"],
        ["Vermilion", "#E34234"],
        ["Citrine", "#E4D00A"],
        ["Citron", "#9FA91F"],
        ["Claret", "#7F1734"],
        ["Classic rose", "#FBCCE7"],
        ["Cobalt", "#0047AB"],
        ["Coconut", "#965A3E"],
        ["Tuscan brown", "#6F4E37"],
        ["Columbia blue", "#9BDDFF"],
        ["Tea rose (orange)", "#F88379"],
        ["Gray-blue", "#8C92AC"],
        ["Copper", "#B87333"],
        ["Pale copper", "#DA8A67"],
        ["Copper penny", "#AD6F69"],
        ["Copper red", "#CB6D51"],
        ["Copper rose", "#996666"],
        ["Coral", "#FF7F50"],
        ["Coral red", "#FF4040"],
        ["Maize", "#FBEC5D"],
        ["Cornflower blue", "#6495ED"],
        ["Cotton candy", "#FFBCD9"],
        ["Cream", "#FFFDD0"],
        ["Crimson", "#DC143C"],
        ["Crimson glory", "#BE0032"],
        ["Cyan", "#00B7EB"],
        ["Cyber Grape", "#58427C"],
        ["Dandelion", "#F0E130"],
        ["Dark blue-gray", "#666699"],
        ["Otter brown", "#654321"],
        ["Dark byzantium", "#5D3954"],
        ["Dark candy apple red", "#A40000"],
        ["Dark cerulean", "#08457E"],
        ["Dark chestnut", "#986960"],
        ["Dark coral", "#CD5B45"],
        ["Dark cyan", "#008B8B"],
        ["Dark goldenrod", "#B8860B"],
        ["Dark gray", "#A9A9A9"],
        ["Dark green", "#013220"],
        ["Dark Indigo", "#00416A"],
        ["Dark jungle green", "#1A2421"],
        ["Dark khaki", "#BDB76B"],
        ["Taupe", "#483C32"],
        ["Dark lavender", "#734F96"],
        ["Dark magenta", "#8B008B"],
        ["Dark midnight blue", "#003366"],
        ["Dark olive green", "#556B2F"],
        ["Dark orange", "#FF8C00"],
        ["Dark orchid", "#9932CC"],
        ["Dark pastel green", "#03C03C"],
        ["Dark pastel purple", "#966FD6"],
        ["Dark pastel red", "#C23B22"],
        ["Dark powder blue", "#003399"],
        ["Dark raspberry", "#872657"],
        ["Dark red", "#8B0000"],
        ["Dark salmon", "#E9967A"],
        ["Dark scarlet", "#560319"],
        ["Dark sea green", "#8FBC8F"],
        ["Dark sienna", "#3C1414"],
        ["Dark slate blue", "#483D8B"],
        ["Dark slate gray", "#2F4F4F"],
        ["Dark spring green", "#177245"],
        ["Dark tan", "#918151"],
        ["Dark turquoise", "#00CED1"],
        ["Dark vanilla", "#D1BEA8"],
        ["Dark violet", "#9400D3"],
        ["Dark yellow", "#9B870C"],
        ["Davys grey", "#555555"],
        ["Deep carmine pink", "#EF3038"],
        ["Deep carrot orange", "#E9692C"],
        ["Deep cerise", "#DA3287"],
        ["Deep chestnut", "#B94E48"],
        ["Deep coffee", "#704241"],
        ["Fuchsia", "#C154C1"],
        ["Deep jungle green", "#004B49"],
        ["Deep lilac", "#9955BB"],
        ["Deep magenta", "#CC00CC"],
        ["Peach", "#FFCBA4"],
        ["Fluorescent pink", "#FF1493"],
        ["Deep ruby", "#843F5B"],
        ["Deep saffron", "#FF9933"],
        ["Deep Taupe", "#7E5E60"],
        ["Deep Tuscan red", "#66424D"],
        ["Deer", "#BA8759"],
        ["Denim", "#1560BD"],
        ["Desert sand", "#EDC9AF"],
        ["Diamond", "#7D1242"],
        ["Dim gray", "#696969"],
        ["Dodger blue", "#1E90FF"],
        ["Dogwood rose", "#D71868"],
        ["Dollar bill", "#85BB65"],
        ["Duke blue", "#00009C"],
        ["Dust storm", "#E5CCC9"],
        ["Ebony", "#555D50"],
        ["Sand", "#C2B280"],
        ["Eggplant", "#614051"],
        ["Egyptian blue", "#1034A6"],
        ["Electric blue", "#7DF9FF"],
        ["Green", "#00FF00"],
        ["Indigo", "#6F00FF"],
        ["Fluorescent yellow", "#CCFF00"],
        ["Violet", "#8F00FF"],
        ["Yellow", "#FFFF00"],
        ["Paris Green", "#50C878"],
        ["English lavender", "#B48395"],
        ["Eton blue", "#96C8A2"],
        ["Eucalyptus", "#44D7A8"],
        ["Falu red", "#801818"],
        ["Hollywood cerise", "#F400A1"],
        ["Fawn", "#E5AA70"],
        ["Feldgrau", "#4D5D53"],
        ["Light apricot", "#FDD5B1"],
        ["Fern green", "#4F7942"],
        ["Field drab", "#6C541E"],
        ["Firebrick", "#B22222"],
        ["Fire engine red", "#CE2029"],
        ["Flame", "#E25822"],
        ["Flamingo pink", "#FC8EAC"],
        ["Flax", "#EEDC82"],
        ["Folly", "#FF004F"],
        ["Forest green (web)", "#228B22"],
        ["Pomp and Power", "#86608E"],
        ["French wine", "#AC1E44"],
        ["Fresh Air", "#A6E7FF"],
        ["Magenta", "#FF00FF"],
        ["Fuchsia pink", "#FF77FF"],
        ["Fuchsia rose", "#C74375"],
        ["Gainsboro", "#DCDCDC"],
        ["Gamboge", "#E49B0F"],
        ["Ginger", "#B06500"],
        ["Glaucous", "#6082B6"],
        ["Gold Fusion", "#85754E"],
        ["Golden brown", "#996515"],
        ["Golden poppy", "#FCC200"],
        ["Goldenrod", "#DAA520"],
        ["Granny Smith Apple", "#A8E4A0"],
        ["Grape", "#6F2DA8"],
        ["Gray-asparagus", "#465945"],
        ["Green (Munsell)", "#00A877"],
        ["Green (pigment)", "#00A550"],
        ["Green (RYB)", "#66B032"],
        ["Green-yellow", "#ADFF2F"],
        ["Grullo", "#A99A86"],
        ["Spring green", "#00FF7F"],
        ["Han blue", "#446CCF"],
        ["Han purple", "#5218FA"],
        ["Harvard crimson", "#C90016"],
        ["Harvest Gold", "#DA9100"],
        ["Olive", "#808000"],
        ["Heliotrope", "#DF73FF"],
        ["Honeydew", "#F0FFF0"],
        ["Honolulu blue", "#006DB0"],
        ["Hookers green", "#49796B"],
        ["Hot pink", "#FF69B4"],
        ["Hunter green", "#355E3B"],
        ["Iceberg", "#71A6D2"],
        ["Illuminating Emerald", "#319177"],
        ["Imperial", "#602F6B"],
        ["Imperial blue", "#002395"],
        ["Inchworm", "#B2EC5D"],
        ["Indian red", "#CD5C5C"],
        ["Indian yellow", "#E3A857"],
        ["Indigo (web)", "#4B0082"],
        ["International Klein Blue", "#002FA7"],
        ["International orange (aerospace)", "#FF4F00"],
        ["International orange (engineering)", "#BA160C"],
        ["Iris", "#5A4FCF"],
        ["Isabelline", "#F4F0EC"],
        ["Islamic green", "#009000"],
        ["Ivory", "#FFFFF0"],
        ["Jade", "#00A86B"],
        ["Jasper", "#D73B3E"],
        ["Jazzberry jam", "#A50B5E"],
        ["Jelly Bean", "#DA614E"],
        ["June bud", "#BDDA57"],
        ["Jungle green", "#29AB87"],
        ["Kelly green", "#4CBB17"],
        ["Khaki (HTML/CSS) (Khaki)", "#C3B091"],
        ["Light khaki", "#F0E68C"],
        ["Sienna", "#882D17"],
        ["Kobi", "#E79FC4"],
        ["KU Crimson", "#E8000D"],
        ["La Salle Green", "#087830"],
        ["Languid lavender", "#D6CADD"],
        ["Laurel green", "#A9BA9D"],
        ["Lavender", "#B57EDC"],
        ["Lavender mist", "#E6E6FA"],
        ["Periwinkle", "#CCCCFF"],
        ["Lavender blush", "#FFF0F5"],
        ["Lavender gray", "#C4C3D0"],
        ["Navy purple", "#9457EB"],
        ["Lavender purple", "#967BB6"],
        ["Lavender rose", "#FBA0E3"],
        ["Lemon", "#FFF700"],
        ["Lemon lime", "#E3FF00"],
        ["Lemon yellow", "#FFF44F"],
        ["Licorice", "#1A1110"],
        ["Light blue", "#ADD8E6"],
        ["Light brown", "#B5651D"],
        ["Light carmine pink", "#E66771"],
        ["Light coral", "#F08080"],
        ["Light cyan", "#E0FFFF"],
        ["Light fuchsia pink", "#F984EF"],
        ["Light gray", "#D3D3D3"],
        ["Light green", "#90EE90"],
        ["Light orchid", "#E6A8D7"],
        ["Light pastel purple", "#B19CD9"],
        ["Light salmon", "#FFA07A"],
        ["Light salmon pink", "#FF9999"],
        ["Light sky blue", "#87CEFA"],
        ["Light slate gray", "#778899"],
        ["Light steel blue", "#B0C4DE"],
        ["Light taupe", "#B38B6D"],
        ["Light yellow", "#FFFFE0"],
        ["Lilac", "#C8A2C8"],
        ["Lime green", "#32CD32"],
        ["Limerick", "#9DC209"],
        ["Lincoln green", "#195905"],
        ["Linen", "#FAF0E6"],
        ["Little boy blue", "#6CA0DC"],
        ["Liver", "#534B4F"],
        ["Magenta", "#CA1F7B"],
        ["Magic mint", "#AAF0D1"],
        ["Magnolia", "#F8F4FF"],
        ["Mahogany", "#C04000"],
        ["Malachite", "#0BDA51"],
        ["Manatee", "#979AAA"],
        ["Mango Tango", "#FF8243"],
        ["Mantis", "#74C365"],
        ["Rich maroon", "#B03060"],
        ["Mauve", "#E0B0FF"],
        ["Raspberry glace", "#915F6D"],
        ["Mauvelous", "#EF98AA"],
        ["Maya blue", "#73C2FB"],
        ["Meat brown", "#E5B73B"],
        ["Medium aquamarine", "#66DDAA"],
        ["Medium blue", "#0000CD"],
        ["Pale carmine", "#AF4035"],
        ["Vanilla", "#F3E5AB"],
        ["Medium electric blue", "#035096"],
        ["Medium jungle green", "#1C352D"],
        ["Plum", "#DDA0DD"],
        ["Medium orchid", "#BA55D3"],
        ["Sapphire blue", "#0067A5"],
        ["Medium red-violet", "#BB3385"],
        ["Medium ruby", "#AA4069"],
        ["Medium sea green", "#3CB371"],
        ["Medium slate blue", "#7B68EE"],
        ["Medium spring bud", "#C9DC87"],
        ["Medium spring green", "#00FA9A"],
        ["Medium taupe", "#674C47"],
        ["Medium turquoise", "#48D1CC"],
        ["Vermilion (Plochere)", "#D9603B"],
        ["Red-violet", "#C71585"],
        ["Mellow apricot", "#F8B878"],
        ["Melon", "#FDBCB4"],
        ["Metallic Seaweed", "#0A7E8C"],
        ["Metallic Sunburst", "#9C7C38"],
        ["Mexican pink", "#E4007C"],
        ["Midnight blue", "#191970"],
        ["Midnight green", "#004953"],
        ["Midori", "#E3F988"],
        ["Mint", "#3EB489"],
        ["Misty rose", "#FFE4E1"],
        ["Moonstone blue", "#73A9C2"],
        ["Moss green", "#ADDFAD"],
        ["Mountbatten pink", "#997A8D"],
        ["MSU Green", "#18453B"],
        ["Mulberry", "#C54B8C"],
        ["Mustard", "#FFDB58"],
        ["Myrtle", "#21421E"],
        ["Napier green", "#2A8000"],
        ["Navajo white", "#FFDEAD"],
        ["Navy blue", "#000080"],
        ["Neon fuchsia", "#FE4164"],
        ["New York pink", "#D7837F"],
        ["North Texas Green", "#059033"],
        ["Nyanza", "#E9FFDB"],
        ["Ochre", "#CC7722"],
        ["Old burgundy", "#43302E"],
        ["Old gold", "#CFB53B"],
        ["Old lace", "#FDF5E6"],
        ["Old lavender", "#796878"],
        ["Wine dregs", "#673147"],
        ["Old rose", "#C08081"],
        ["Olive Drab #3", "#6B8E23"],
        ["Olive Drab #7", "#3C341F"],
        ["Olivine", "#9AB973"],
        ["Onyx", "#353839"],
        ["Opera mauve", "#B784A7"],
        ["Orange", "#FF7F00"],
        ["Orange (RYB)", "#FB9902"],
        ["Orange-red", "#FF4500"],
        ["Orchid", "#DA70D6"],
        ["Orchid pink", "#F28DCD"],
        ["Outer Space", "#414A4C"],
        ["Oxford Blue", "#002147"],
        ["Pakistan green", "#006600"],
        ["Palatinate blue", "#273BE2"],
        ["Pale turquoise", "#AFEEEE"],
        ["Pale brown", "#987654"],
        ["Pale cerulean", "#9BC4E2"],
        ["Pale chestnut", "#DDADAF"],
        ["Pale cornflower blue", "#ABCDEF"],
        ["Pale gold", "#E6BE8A"],
        ["Pale goldenrod", "#EEE8AA"],
        ["Pale green", "#98FB98"],
        ["Pale lavender", "#DCD0FF"],
        ["Pale magenta", "#F984E5"],
        ["Pale pink", "#FADADD"],
        ["Pale violet-red", "#DB7093"],
        ["Pale robin egg blue", "#96DED1"],
        ["Pale silver", "#C9C0BB"],
        ["Pale spring bud", "#ECEBBD"],
        ["Pale taupe", "#BC987E"],
        ["Pansy purple", "#78184A"],
        ["Pastel blue", "#AEC6CF"],
        ["Pastel brown", "#836953"],
        ["Pastel gray", "#CFCFC4"],
        ["Pastel green", "#77DD77"],
        ["Pastel magenta", "#F49AC2"],
        ["Pastel pink", "#DEA5A4"],
        ["Pastel purple", "#B39EB5"],
        ["Pastel red", "#FF6961"],
        ["Pastel violet", "#CB99C9"],
        ["Pastel yellow", "#FDFD96"],
        ["Peach-orange", "#FFCC99"],
        ["Pear", "#D1E231"],
        ["Pearl", "#EAE0C8"],
        ["Pearl Aqua", "#88D8C0"],
        ["Pearly purple", "#B768A2"],
        ["Persian blue", "#1C39BB"],
        ["Persian green", "#00A693"],
        ["Persian indigo", "#32127A"],
        ["Persian orange", "#D99058"],
        ["Persian pink", "#F77FBE"],
        ["Prune", "#701C1C"],
        ["Persian rose", "#FE28A2"],
        ["Persimmon", "#EC5800"],
        ["Psychedelic purple", "#DF00FF"],
        ["Pictorial carmine", "#C30B4E"],
        ["Pine green", "#01796F"],
        ["Pink", "#FFC0CB"],
        ["Pink lace", "#FFDDF4"],
        ["Pink pearl", "#E7ACCF"],
        ["Pistachio", "#93C572"],
        ["Platinum", "#E5E4E2"],
        ["Plum (traditional)", "#8E4585"],
        ["Portland Orange", "#FF5A36"],
        ["Prussian blue", "#003153"],
        ["Puce", "#CC8899"],
        ["Pumpkin", "#FF7518"],
        ["Veronica", "#A020F0"],
        ["Purple pizzazz", "#FE4EDA"],
        ["Purple taupe", "#50404D"],
        ["Queen blue", "#436B95"],
        ["Queen pink", "#E8CCD7"],
        ["Raspberry", "#E30B5D"],
        ["Raspberry pink", "#E25098"],
        ["Raw umber", "#826644"],
        ["Red", "#FF0000"],
        ["Red (pigment)", "#ED1C24"],
        ["Rose vale", "#AB4E52"],
        ["Regalia", "#522D80"],
        ["Rhythm", "#777696"],
        ["Rich black", "#004040"],
        ["Rich brilliant lavender", "#F1A7FE"],
        ["Rich electric blue", "#0892D0"],
        ["Rich lavender", "#A76BCF"],
        ["Rich lilac", "#B666D2"],
        ["Rifle green", "#414833"],
        ["Rocket metallic", "#8A7F80"],
        ["Roman silver", "#838996"],
        ["Rose gold", "#B76E79"],
        ["Rose pink", "#FF66CC"],
        ["Rose quartz", "#AA98A9"],
        ["Rose taupe", "#905D5D"],
        ["Rosewood", "#65000B"],
        ["Rosy brown", "#BC8F8F"],
        ["Royal azure", "#0038A8"],
        ["Royal blue (traditional)", "#002366"],
        ["Royal blue", "#4169E1"],
        ["Royal fuchsia", "#CA2C92"],
        ["Royal purple", "#7851A9"],
        ["Rubine red", "#D10056"],
        ["Ruby red", "#9B111E"],
        ["Ruddy", "#FF0028"],
        ["Ruddy brown", "#BB6528"],
        ["Ruddy pink", "#E18E96"],
        ["Russet", "#80461B"],
        ["Rusty red", "#DA2C43"],
        ["Saddle brown", "#8B4513"],
        ["Safety orange (blaze orange)", "#FF6700"],
        ["Saffron", "#F4C430"],
        ["Salmon", "#FF8C69"],
        ["Salmon pink", "#FF91A4"],
        ["Sandstorm", "#ECD540"],
        ["Sandy brown", "#F4A460"],
        ["Sap green", "#507D2A"],
        ["Sapphire", "#0F52BA"],
        ["Sassy Pink", "#FABBBB"],
        ["Satin sheen gold", "#CBA135"],
        ["School bus yellow", "#FFD800"],
        ["Screaming Green", "#76FF7A"],
        ["Sea blue", "#006994"],
        ["Sea green", "#2E8B57"],
        ["Seal brown", "#321414"],
        ["Sepia", "#704214"],
        ["Shadow", "#8A795D"],
        ["Shamrock green", "#009E60"],
        ["Sheen Green", "#8FD400"],
        ["Shimmering Blush", "#D98695"],
        ["Shocking pink", "#FC0FC0"],
        ["Silver", "#C0C0C0"],
        ["Silver pink", "#C4AEAD"],
        ["Skobeloff", "#007474"],
        ["Sky blue", "#87CEEB"],
        ["Slate blue", "#6A5ACD"],
        ["Slate gray", "#708090"],
        ["Smoke", "#738276"],
        ["Smokey topaz", "#933D41"],
        ["Smoky black", "#100C08"],
        ["Soap", "#CEC8EF"],
        ["Sonic silver", "#757575"],
        ["Space cadet", "#1D2951"],
        ["Spanish carmine", "#D10047"],
        ["Spring bud", "#A7FC00"],
        ["Star command blue", "#007BBB"],
        ["Steel blue", "#4682B4"],
        ["Stormcloud", "#4F666A"],
        ["Straw", "#E4D96F"],
        ["Strawberry", "#FC5A8D"],
        ["Super pink", "#CF6BA9"],
        ["Tan", "#D2B48C"],
        ["Tangerine", "#F28500"],
        ["Taupe gray", "#8B8589"],
        ["Tea green", "#D0F0C0"],
        ["Teal", "#008080"],
        ["Teal blue", "#367588"],
        ["Teal deer", "#99E6B3"],
        ["Terra cotta", "#E2725B"],
        ["Thistle", "#D8BFD8"],
        ["Tigers eye", "#E08D3C"],
        ["Timberwolf", "#DBD7D2"],
        ["Tomato", "#FF6347"],
        ["Toolbox", "#746CC0"],
        ["Topaz", "#FFC87C"],
        ["Tropical rain forest", "#00755E"],
        ["True Blue", "#0073CF"],
        ["Tufts Blue", "#417DC1"],
        ["Tulip", "#FF878D"],
        ["Tumbleweed", "#DEAA88"],
        ["Turquoise", "#30D5C8"],
        ["Turquoise blue", "#00FFEF"],
        ["Turquoise green", "#A0D6B4"],
        ["Tuscan red", "#7C4848"],
        ["Tuscany", "#C09999"],
        ["Twilight lavender", "#8A496B"],
        ["Tyrian purple", "#66023C"],
        ["Ube", "#8878C3"],
        ["UCLA Blue", "#536895"],
        ["UCLA Gold", "#FFB300"],
        ["UFO Green", "#3CD070"],
        ["Ultramarine blue", "#4166F5"],
        ["Umber", "#635147"],
        ["Unbleached silk", "#FFDDCA"],
        ["Vegas gold", "#C5B358"],
        ["Venetian red", "#C80815"],
        ["Verdigris", "#43B3AE"],
        ["Violet", "#8601AF"],
        ["Violet-blue", "#324AB2"],
        ["Violet-red", "#F75394"],
        ["Viridian", "#40826D"],
        ["Vivid auburn", "#922724"],
        ["Vivid burgundy", "#9F1D35"],
        ["Vivid orchid", "#CC00FF"],
        ["Vivid tangerine", "#FFA089"],
        ["Waterspout", "#A4F4F9"],
        ["Wenge", "#645452"],
        ["Wheat", "#F5DEB3"],
        ["White", "#FFFFFF"],
        ["White smoke", "#F5F5F5"],
        ["Wild blue yonder", "#A2ADD0"],
        ["Wild orchid", "#D77A02"],
        ["Wild Strawberry", "#FF43A4"],
        ["Windsor tan", "#AE6838"],
        ["Wine", "#722F37"],
        ["Wisteria", "#C9A0DC"],
        ["Yellow-green", "#9ACD32"],
        ["Yellow Orange", "#FFAE42"],
        ["Zaffre", "#0014A8"],
        ["Zinnwaldite brown", "#2C1608"],
    ],
};
generalColourList.init();
var dmcPaletteColourSource = {
    code: "D",
    threshold: 0.5,
    canvas: null,
    ctx: null,
    img: null,
    imgData: null,
    lastId: "",
    numColours: 454,
    strongChoice: false,
    init: function() {
        this.canvas = document.getElementById("dmcPaletteCanvas");
        if (this.canvas) {
            this.ctx = this.canvas.getContext("2d");
            this.img = document.getElementById("dmcPaletteImage");
            $(this.img).load(function() {
                dmcPaletteColourSource.getImage()
            });
            this.getImage();
            this.startMouse()
        }
        this.numColours = dmcColours.numColours
    },
    getImage: function() {
        this.img = document.getElementById("dmcPaletteImage");
        this.ctx.drawImage(this.img, 0, 0);
        this.imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    },
    fromId: function(b) {
        var a = dmcColours.lookup(b);
        if (a) {
            return a.colour
        }
        return "#ffffff"
    },
    toId: function(b) {
        var a = dmcColours.nearest(b);
        if (a) {
            return a.id
        }
        return "#ffffff"
    },
    idName: function(b) {
        var a = dmcColours.lookup(b);
        if (a) {
            return a.name
        }
        return "unknown DMC"
    },
    showId: function(b, a) {},
    activate: function() {
        this.lastId = ""
    },
    moveCapture: false,
    idAt: function(m) {
        var e = $(this.img).offset();
        var l = Math.round(m.clientX - e.left + window.pageXOffset);
        var j = Math.round(m.clientY - e.top + window.pageYOffset);
        if (l < 0 || this.canvas.width <= l || j < 0 || this.canvas.height <= j) {
            this.moveCapture = false;
            MouseMoveCapture.end();
            cdoToolTip.hide();
            return ""
        }
        if (!this.moveCapture) {
            this.moveCapture = true;
            MouseMoveCapture.start({
                self: this
            }, dmcPaletteColourSource.handleMouseMove)
        }
        var f = (l + j * this.canvas.width) * 4;
        var c = this.imgData.data[f++];
        var h = this.imgData.data[f++];
        var k = this.imgData.data[f];
        var a = rgb2css(c, h, k);
        var d = dmcColours.lookupColour(a).id;
        return d
    },
    over: function(a) {
        var b = this.idAt(a);
        if (!b) {
            cdoToolTip.hide();
            return ""
        }
        if (b != this.lastId) {
            cdoToolTip.show(a, this.idName(b))
        }
        return b
    },
    select: function(a) {
        var b = this.over(a);
        if (!b) {
            return
        }
        colourSource.setId(b)
    },
    startMouse: function() {
        var a = $(this.img);
        a.mousedown({
            self: this
        }, dmcPaletteColourSource.handleMouseDown);
        a.on("touchstart", {
            self: this
        }, dmcPaletteColourSource.handleTouchDown);
        a.mousemove({
            self: this
        }, dmcPaletteColourSource.handleMouseMove);
        a.on("touchmove", {
            self: this
        }, dmcPaletteColourSource.handleTouchMove)
    },
    mousedown: false,
    extractTouch: function(a) {
        if (a.originalEvent.touches && a.originalEvent.touches[0]) {
            a.clientX = a.originalEvent.touches[0].clientX;
            a.clientY = a.originalEvent.touches[0].clientY
        }
    },
    handleMouseDown: function(a) {
        var b = a.data.self;
        b.mousedown = true;
        a.preventDefault();
        b.select(a);
        MouseUpCapture.start({
            self: b
        }, dmcPaletteColourSource.handleMouseUp);
        MouseMoveCapture.start({
            self: b
        }, dmcPaletteColourSource.handleMouseMove);
        TouchEndCapture.start({
            self: b
        }, dmcPaletteColourSource.handleTouchUp);
        TouchMoveCapture.start({
            self: b
        }, dmcPaletteColourSource.handleTouchMove)
    },
    handleTouchDown: function(a) {
        dmcPaletteColourSource.extractTouch(a);
        dmcPaletteColourSource.handleMouseDown(a)
    },
    handleMouseMove: function(a) {
        var b = a.data.self;
        if (!b.mousedown) {
            b.over(a);
            return
        }
        a.preventDefault();
        b.select(a)
    },
    handleTouchMove: function(a) {
        dmcPaletteColourSource.extractTouch(a);
        dmcPaletteColourSource.handleMouseMove(a)
    },
    handleMouseUp: function(a) {
        var b = a.data.self;
        b.mousedown = false;
        b.moveCapture = false;
        cdoToolTip.hide();
        a.preventDefault();
        MouseUpCapture.end();
        MouseMoveCapture.end();
        TouchEndCapture.end();
        TouchMoveCapture.end();
        b.select(a)
    },
    handleTouchUp: function(a) {
        dmcPaletteColourSource.extractTouch(a);
        dmcPaletteColourSource.handleMouseUp(a)
    },
    fromIndex: function(a) {
        return dmcColours.fromIndex(a)
    },
};
var dmcNumberColourSource = {
    code: dmcPaletteColourSource.code,
    threshold: 0.5,
    input: null,
    numColours: 454,
    strongChoice: true,
    init: function() {
        this.input = $("#dmcNumberInput");
        this.input.change(function() {
            dmcNumberColourSource.inputChanged()
        });
        $("#dmcNumberInputSet").click(function() {
            dmcNumberColourSource.inputChanged()
        });
        this.numColours = dmcColours.numColours
    },
    fromId: function(b) {
        var a = dmcColours.lookup(b);
        if (a) {
            return a.colour
        }
        return "#ffffff"
    },
    toId: function(b) {
        var a = dmcColours.nearest(b);
        if (a) {
            return a.id
        }
        return "#ffffff"
    },
    idName: function(b) {
        var a = dmcColours.lookup(b);
        if (a) {
            return a.name
        }
        return "unknown DMC"
    },
    doNotify: true,
    showId: function(c, a) {
        this.doNotify = false;
        var b = dmcColours.lookup(c);
        if (b) {
            this.input.val(b.code)
        }
        this.doNotify = true;
        this.showDetails(b, a)
    },
    activate: function() {},
    inputChanged: function() {
        var b = this.input.val();
        var a = dmcColours.lookup(b);
        if (a) {
            colourSource.id = a.id;
            if (this.doNotify) {
                colourSource.notify(a.id)
            }
        }
        this.showDetails(a, null)
    },
    showDetails: function(e, d) {
        var c = "unknown DMC";
        var b = "#ffffff";
        if (e) {
            c = e.colName;
            b = e.colour;
            if (d && e.id != d) {
                c = "Similar to: " + c
            }
        }
        $("#dmcNumberName").text(c);
        var f = $("#dmcNumberSample");
        f.css("background-color", b);
        var a = f.position().top;
        f.css("height", 194 - a)
    },
    fromIndex: function(a) {
        return dmcColours.fromIndex(a)
    },
};

function DMCColour(c, b, a, d) {
    this.code = c;
    this.id = "D" + c;
    this.name = "DMC " + c + ", " + b;
    this.colName = b;
    this.card = a;
    this.colour = d;
    this.cdoColour = new CdoColour(d)
}
dmcColours = {
    colours: null,
    colourIndex: null,
    colourTable: null,
    numColours: 0,
    init: function() {
        var e = [
            ["304", "Middle Red", 1, "#780216"],
            ["321", "Red", 1, "#7c0215"],
            ["347", "Very Dark Salmon", 1, "#9b0722"],
            ["349", "Dark Coral", 1, "#a20419"],
            ["350", "Middle Coral", 1, "#bd1a26"],
            ["351", "Coral", 1, "#cc453d"],
            ["352", "Light Coral", 1, "#da7662"],
            ["353", "Peach", 1, "#e4a791"],
            ["498", "Dark Red", 1, "#750216"],
            ["666", "Bright Red", 1, "#a70115"],
            ["760", "Salmon", 1, "#d1797a"],
            ["761", "Light Salmon", 1, "#da9d9c"],
            ["814", "Dark Garnet", 1, "#3d0715"],
            ["815", "Middle Garnet", 1, "#540314"],
            ["816", "Garnet", 1, "#670216"],
            ["817", "Very Dark Coral Red", 1, "#910211"],
            ["3328", "Dark Salmon", 1, "#ad333f"],
            ["3705", "Dark Melon", 1, "#ca2140"],
            ["3706", "Middle Melon", 1, "#e56772"],
            ["3708", "Light Melon", 1, "#ec8d9f"],
            ["3712", "Middle Salmon", 1, "#c1585b"],
            ["3713", "Very Light Salmon", 1, "#e9c3c0"],
            ["3801", "Very Dark Melon", 1, "#bd0426"],
            ["309", "Dark Rose", 2, "#9c0e35"],
            ["326", "Very Dark Rose", 2, "#8c062a"],
            ["335", "Rose", 2, "#c14364"],
            ["776", "Middle Pink", 2, "#df919d"],
            ["777", "Very Dark Raspberry", 2, "#6a0220"],
            ["818", "Baby Pink", 2, "#e7c6c3"],
            ["819", "Light Baby Pink", 2, "#f0ddd8"],
            ["891", "Dark Carnation", 2, "#e1344b"],
            ["892", "Middle Carnation", 2, "#e84856"],
            ["893", "Light Carnation", 2, "#e66273"],
            ["894", "Very Light Carnation", 2, "#ee899a"],
            ["899", "Middle Rose", 2, "#d0647e"],
            ["956", "Geranium", 2, "#e95d7c"],
            ["957", "Pale Geranium", 2, "#f192a4"],
            ["961", "Dark Dusty Rose", 2, "#c44a6b"],
            ["962", "Middle Dusty Rose", 2, "#c6617f"],
            ["963", "Ultra Very Light Dusty Rose", 2, "#e9b9c1"],
            ["3326", "Light Rose", 2, "#df929e"],
            ["3716", "Very Light Dusty Rose", 2, "#e297a6"],
            ["3831", "Dark Raspberry", 2, "#98082e"],
            ["3832", "Middle Raspberry", 2, "#b7304e"],
            ["3833", "Light Raspberry", 2, "#c8596f"],
            ["150", "Ultra Very Dark Dusty Rose", 3, "#7a0427"],
            ["151", "Very Light Dusty Rose", 3, "#e1acbc"],
            ["600", "Very Dark Cranberry", 3, "#b20b4d"],
            ["601", "Dark Cranberry", 3, "#b70f51"],
            ["602", "Middle Cranberry", 3, "#d04378"],
            ["603", "Cranberry", 3, "#da6e93"],
            ["604", "Light Cranberry", 3, "#e390b0"],
            ["605", "Very Light Cranberry", 3, "#e0a0bb"],
            ["718", "Plum", 3, "#91085a"],
            ["915", "Dark Plum", 3, "#64032f"],
            ["917", "Middle Plum", 3, "#930d5a"],
            ["3350", "Ultra Dark Dusty Rose", 3, "#931441"],
            ["3354", "Light Dusty Rose", 3, "#c68895"],
            ["3607", "Light Plum", 3, "#ad357e"],
            ["3608", "Very Light Plum", 3, "#cf86b1"],
            ["3609", "Ultra Light Plum", 3, "#d195bf"],
            ["3685", "Very Dark Mauve", 3, "#510420"],
            ["3687", "Mauve", 3, "#a64266"],
            ["3688", "Middle Mauve", 3, "#b96a85"],
            ["3689", "Light Mauve", 3, "#dda5b9"],
            ["3731", "Very Dark Dusty Rose", 3, "#ac3e5d"],
            ["3733", "Dusty Rose", 3, "#c3697d"],
            ["3803", "Dark Mauve", 3, "#6c0b38"],
            ["3804", "Dark Cyclamen Pink", 3, "#b81d63"],
            ["3805", "Cyclamen Pink", 3, "#b82569"],
            ["3806", "Light Cyclamen Pink", 3, "#d46f95"],
            ["152", "Middle Light Shell Pink", 4, "#b98d87"],
            ["154", "Very Dark Grape", 4, "#1f0c1a"],
            ["221", "Very Dark Shell Pink", 4, "#610e1d"],
            ["223", "Light Shell Pink", 4, "#9a595e"],
            ["224", "Very Light Shell Pink", 4, "#ca9f99"],
            ["225", "Ultra Very Light Shell Pink", 4, "#e0c7c0"],
            ["315", "Middle Dark Antique Mauve", 4, "#642b3a"],
            ["316", "Middle Antique Mauve", 4, "#a36285"],
            ["778", "Very Light Antique Mauve", 4, "#be999c"],
            ["902", "Very Dark Garnet", 4, "#450b1a"],
            ["3041", "Middle Antique Violet", 4, "#5c4658"],
            ["3042", "Light Antique Violet", 4, "#8d8292"],
            ["3721", "Dark Shell Pink", 4, "#7b2632"],
            ["3722", "Middle Shell Pink", 4, "#8c3e47"],
            ["3726", "Dark Antique Mauve", 4, "#773f4e"],
            ["3727", "Light Antique Mauve", 4, "#b98e9a"],
            ["3740", "Dark Antique Violet", 4, "#523849"],
            ["3743", "Very Light Antique Violet", 4, "#a8a2af"],
            ["3802", "Very Dark Antique Mauve", 4, "#4b1227"],
            ["3834", "Dark Grape", 4, "#4b1a42"],
            ["3835", "Middle Grape", 4, "#74426e"],
            ["3836", "Light Grape", 4, "#9b6e94"],
            ["153", "Very Light Violet", 5, "#c5a0c2"],
            ["155", "Middle Dark Blue Violet", 5, "#6c67ad"],
            ["156", "Middle Light Blue Violet", 5, "#6175ac"],
            ["157", "Very Light Cornflower Blue", 5, "#86a3c7"],
            ["158", "Middle Very Dark Cornflower Blue", 5, "#1c316b"],
            ["208", "Very Dark Lavender", 5, "#6c3787"],
            ["209", "Dark Lavender", 5, "#9a71af"],
            ["210", "Middle Lavender", 5, "#b091ca"],
            ["211", "Light Lavender", 5, "#c4b0d9"],
            ["327", "Dark Violet", 5, "#4c2254"],
            ["333", "Very Dark Blue Violet", 5, "#362f7f"],
            ["340", "Middle Blue Violet", 5, "#6b6eb3"],
            ["341", "Light Blue Violet", 5, "#7b90ba"],
            ["550", "Very Dark Violet", 5, "#320843"],
            ["552", "Middle Violet", 5, "#612876"],
            ["553", "Violet", 5, "#7a438a"],
            ["554", "Light Violet", 5, "#ad7fb3"],
            ["791", "Very Dark Cornflower Blue", 5, "#15225d"],
            ["792", "Dark Cornflower Blue", 5, "#19367b"],
            ["793", "Middle Cornflower Blue", 5, "#4c6697"],
            ["794", "Light Cornflower Blue", 5, "#6488b3"],
            ["3746", "Dark Blue Violet", 5, "#464794"],
            ["3747", "Very Light Blue Violet", 5, "#acb7cc"],
            ["3807", "Cornflower Blue", 5, "#364f8a"],
            ["3837", "Ultra Dark Lavender", 5, "#572076"],
            ["162", "Ultra Very Light Blue", 6, "#a5c5d4"],
            ["796", "Dark Royal Blue", 6, "#06155a"],
            ["797", "Royal Blue", 6, "#081f5f"],
            ["798", "Dark Delft Blue", 6, "#104891"],
            ["799", "Middle Delft Blue", 6, "#3f73a9"],
            ["800", "Pale Delft Blue", 6, "#88adca"],
            ["809", "Delft Blue", 6, "#5d85b8"],
            ["813", "Light Blue", 6, "#4d85b0"],
            ["820", "Very Dark Royal Blue", 6, "#050c46"],
            ["824", "Very Dark Blue", 6, "#06326c"],
            ["825", "Dark Blue", 6, "#06407c"],
            ["826", "Middle Blue", 6, "#165a93"],
            ["827", "Very Light Blue", 6, "#82acca"],
            ["995", "Dark Electric Blue", 6, "#034fac"],
            ["996", "Middle Electric Blue", 6, "#1e8fd3"],
            ["3838", "Dark Lavender Blue", 6, "#345ba1"],
            ["3839", "Middle Lavender Blue", 6, "#5978b5"],
            ["3840", "Light Lavender Blue", 6, "#8cabd3"],
            ["3843", "Electric Blue", 6, "#0268be"],
            ["3844", "Dark Bright Turquoise", 6, "#0271ab"],
            ["3845", "Middle Bright Turquoise", 6, "#03a1cc"],
            ["3846", "Light Bright Turquoise", 6, "#09aed1"],
            ["159", "Light Gray Blue", 7, "#909db9"],
            ["160", "Middle Gray Blue", 7, "#62759b"],
            ["161", "Gray Blue", 7, "#435880"],
            ["312", "Very Dark Baby Blue", 7, "#083165"],
            ["322", "Dark Dark Baby Blue", 7, "#2e6095"],
            ["334", "Middle Baby Blue", 7, "#306c98"],
            ["336", "Navy Blue", 7, "#0a1637"],
            ["775", "Very Light Baby Blue", 7, "#b3ccd4"],
            ["803", "Ultra Very Dark Baby Blue", 7, "#072252"],
            ["823", "Dark Navy Blue", 7, "#0b0d24"],
            ["930", "Dark Antique Blue", 7, "#133346"],
            ["931", "Middle Antique Blue", 7, "#285870"],
            ["932", "Light Antique Blue", 7, "#5e8397"],
            ["939", "Very Dark Navy Blue", 7, "#090714"],
            ["3325", "Light Baby Blue", 7, "#729cbe"],
            ["3750", "Very Dark Antique Blue", 7, "#0a223a"],
            ["3752", "Very Light Antique Blue", 7, "#86a5b7"],
            ["3753", "Ultra Very Light Antique Blue", 7, "#a4bcc6"],
            ["3755", "Baby Blue", 7, "#598bb5"],
            ["3756", "Ultra Very Light Baby Blue", 7, "#cfddd9"],
            ["3841", "Pale Baby Blue", 7, "#99b8cb"],
            ["311", "Middle Navy Blue", 8, "#072049"],
            ["517", "Dark Wedgewood", 8, "#094880"],
            ["518", "Light Wedgewood", 8, "#24739a"],
            ["519", "Sky Blue", 8, "#6ca0c0"],
            ["597", "Turquoise", 8, "#38869a"],
            ["598", "Light Turquoise", 8, "#6eaab0"],
            ["747", "Very Light Sky Blue", 8, "#c1dde1"],
            ["806", "Dark Peacock Blue", 8, "#135f90"],
            ["807", "Peacock Blue", 8, "#2681a0"],
            ["828", "Ultra Very Very Light Blue", 8, "#a9c9d0"],
            ["924", "Very Dark Gray Green", 8, "#0e333e"],
            ["926", "Middle Gray Green", 8, "#506f70"],
            ["927", "Light Gray Green", 8, "#819e99"],
            ["928", "Very Light Gray Green", 8, "#a5bab4"],
            ["3760", "Middle Wedgewood", 8, "#145f8f"],
            ["3761", "Light Sky Blue", 8, "#8ebacc"],
            ["3765", "Very Dark Peacock Blue", 8, "#064a79"],
            ["3766", "Light Peacock Blue", 8, "#599eb4"],
            ["3768", "Dark Gray Green", 8, "#35555f"],
            ["3808", "Ultra Very Dark Turquoise", 8, "#05324d"],
            ["3809", "Very Dark Turquoise", 8, "#044961"],
            ["3810", "Dark Turquoise", 8, "#0c657b"],
            ["3811", "Very Light Turquoise", 8, "#87b9bd"],
            ["3842", "Dark Wedgwood", 8, "#043268"],
            ["3847", "Dark Teal Green", 8, "#044147"],
            ["3848", "Middle Teal Green", 8, "#066468"],
            ["3849", "Light Teal Green", 8, "#268a8e"],
            ["163", "Middle Celadon Green", 9, "#187458"],
            ["500", "Very Dark Blue Green", 9, "#0d2b29"],
            ["501", "Dark Blue Green", 9, "#124f41"],
            ["502", "Blue Green", 9, "#2c725e"],
            ["503", "Middle Blue Green", 9, "#529685"],
            ["504", "Very Light Blue Green", 9, "#84b2a2"],
            ["505", "Jade Green", 9, "#055d38"],
            ["561", "Very Dark Jade", 9, "#07563f"],
            ["562", "Middle Jade", 9, "#147b53"],
            ["563", "Light Jade", 9, "#57ae91"],
            ["564", "Very Light Jade", 9, "#79bf9f"],
            ["943", "Middle Aquamarine", 9, "#02776b"],
            ["958", "Dark Seagreen", 9, "#0b948d"],
            ["959", "Middle Seagreen", 9, "#23a6a1"],
            ["964", "Light Seagreen", 9, "#7ac6c4"],
            ["966", "Middle Baby Green", 9, "#77b391"],
            ["991", "Dark Aquamarine", 9, "#025b54"],
            ["992", "Light Aquamarine", 9, "#229688"],
            ["993", "Very Light Aquamarine", 9, "#40a394"],
            ["3812", "Very Dark Seagreen", 9, "#027374"],
            ["3813", "Light Blue Green", 9, "#88b5a5"],
            ["3814", "Aquamarine", 9, "#03675f"],
            ["3815", "Dark Celadon Green", 9, "#0f6650"],
            ["3816", "Celadon Green", 9, "#3a8373"],
            ["3817", "Light Celadon Green", 9, "#71ac96"],
            ["3850", "Dark Bright Green", 9, "#026b5b"],
            ["3851", "Light Bright Green", 9, "#07907e"],
            ["164", "Light Forest Green", 10, "#77ba7d"],
            ["319", "Very Dark Pistachio Green", 10, "#062e1b"],
            ["320", "Middle Pistachio Green", 10, "#42845e"],
            ["367", "Dark Pistachio Green", 10, "#1d6742"],
            ["368", "Light Pistachio Green", 10, "#66a46d"],
            ["369", "Very Light Pistachio Green", 10, "#a1cd9a"],
            ["772", "Very Light Yellow Green", 10, "#c1d8ab"],
            ["890", "Ultra Dark Pistachio Green", 10, "#042914"],
            ["895", "Very Dark Hunter Green", 10, "#0b4122"],
            ["909", "Very Dark Emerald Green", 10, "#03522a"],
            ["910", "Dark Emerald Green", 10, "#026e39"],
            ["911", "Middle Emerald Green", 10, "#037c47"],
            ["912", "Light Emerald Green", 10, "#0e9466"],
            ["913", "Middle Nile Green", 10, "#39ae7f"],
            ["954", "Nile Green", 10, "#64bd91"],
            ["955", "Light Nile Green", 10, "#9cd9b5"],
            ["986", "Very Dark Forest Green", 10, "#05481a"],
            ["987", "Dark Forest Green", 10, "#11692f"],
            ["988", "Middle Forest Green", 10, "#2d8441"],
            ["989", "Forest Green", 10, "#4c9a54"],
            ["3345", "Dark Hunter Green", 10, "#0c4619"],
            ["3346", "Hunter Green", 10, "#256725"],
            ["3347", "Middle Yellow Green", 10, "#448236"],
            ["3348", "Light Yellow Green", 10, "#9db670"],
            ["3818", "Ultra Very Dark Emerald Greene", 10, "#034326"],
            ["469", "Avocado Green", 11, "#2f5d12"],
            ["470", "Light Avocado Green", 11, "#4d8721"],
            ["471", "Very Light Avocado Green", 11, "#6a9633"],
            ["472", "Ultra Light Avocado Green", 11, "#a4bf62"],
            ["520", "Dark Fern Green", 11, "#214a32"],
            ["522", "Fern Green", 11, "#6f9377"],
            ["523", "Light Fern Green", 11, "#7e9b7a"],
            ["524", "Very Light Fern Green", 11, "#93a489"],
            ["699", "Green", 11, "#023e1d"],
            ["700", "Bright Green", 11, "#03632a"],
            ["701", "Light Green", 11, "#047733"],
            ["702", "Kelly Green", 11, "#12883a"],
            ["703", "Chartreuse", 11, "#469f43"],
            ["704", "Bright Chartreuse", 11, "#62a93a"],
            ["904", "Very Dark Parrot Green", 11, "#095912"],
            ["905", "Dark Parrot Green", 11, "#086c10"],
            ["906", "Middle Parrot Green", 11, "#149509"],
            ["907", "Light Parrot Green", 11, "#69b316"],
            ["934", "Black Avocado Green", 11, "#132718"],
            ["935", "Dark Avocado Green", 11, "#193720"],
            ["936", "Very Dark Avocado Green", 11, "#26451b"],
            ["937", "Middle Avocado Green", 11, "#255115"],
            ["3051", "Dark Green Gray", 11, "#334a25"],
            ["3052", "Middle Green Gray", 11, "#667e56"],
            ["3053", "Green Gray", 11, "#799065"],
            ["165", "Very Light Moss Green", 12, "#bbc66d"],
            ["166", "Middle Light Moss Green", 12, "#8d9f15"],
            ["370", "Middle Mustard", 12, "#838344"],
            ["371", "Mustard", 12, "#858147"],
            ["372", "Light Mustard", 12, "#919661"],
            ["580", "Dark Moss Green", 12, "#44620d"],
            ["581", "Moss Green", 12, "#64901f"],
            ["730", "Very Dark Olive Green", 12, "#3e480d"],
            ["731", "Dark Olive Green", 12, "#565f0d"],
            ["732", "Olive Green", 12, "#565e0e"],
            ["733", "Middle Olive Green", 12, "#898d26"],
            ["734", "Light Olive Green", 12, "#9da045"],
            ["829", "Very Dark Golden Olive", 12, "#534314"],
            ["830", "Dark Golden Olive", 12, "#534d13"],
            ["831", "Middle Golden Olive", 12, "#686314"],
            ["832", "Golden Olive", 12, "#847818"],
            ["833", "Light Golden Olive", 12, "#979035"],
            ["834", "Very Light Golden Olive", 12, "#b2ac56"],
            ["3011", "Dark Khaki Green", 12, "#4e5827"],
            ["3012", "Middle Khaki Green", 12, "#6c763b"],
            ["3013", "Light Khaki Green", 12, "#95a16b"],
            ["3362", "Dark Pine Green", 12, "#295531"],
            ["3363", "Middle Pine Green", 12, "#3e6d42"],
            ["3364", "Pine Green", 12, "#6a8f59"],
            ["3819", "Light Moss Green", 12, "#b5c353"],
            ["167", "Very Dark Yellow Beige", 13, "#7f6931"],
            ["420", "Dark Hazelnut Brown", 13, "#79581e"],
            ["422", "Light Hazelnut Brown", 13, "#ad9d68"],
            ["610", "Dark Drab Brown", 13, "#665a31"],
            ["611", "Drab Brown", 13, "#64603b"],
            ["612", "Light Drab Brown", 13, "#968d65"],
            ["613", "Very Light Drab Brown", 13, "#bec1a5"],
            ["676", "Light Old Gold", 13, "#ccb668"],
            ["677", "Very Light Old Gold", 13, "#dad8a1"],
            ["680", "Dark Old Gold", 13, "#937a29"],
            ["728", "Topaz", 13, "#d7ae31"],
            ["729", "Middle Old Gold", 13, "#ae9133"],
            ["746", "Off White", 13, "#e5e6c9"],
            ["780", "Ultra Very Dark Topaz", 13, "#7f4d0f"],
            ["781", "Very Dark Topaz", 13, "#9b6b0c"],
            ["782", "Dark Topaz", 13, "#99690b"],
            ["783", "Middle Topaz", 13, "#b38616"],
            ["869", "Very Dark Hazelnut Brown", 13, "#5f4b1a"],
            ["3045", "Dark Yellow Beige", 13, "#97834c"],
            ["3046", "Middle Yellow Beige", 13, "#b6b06e"],
            ["3047", "Light Yellow Beige", 13, "#cfd199"],
            ["3820", "Dark Straw", 13, "#c1a425"],
            ["3821", "Straw", 13, "#ceb844"],
            ["3822", "Light Straw", 13, "#dbca67"],
            ["3828", "Hazelnut Brown", 13, "#927d3f"],
            ["3829", "Very Dark Old Gold", 13, "#8b6d1a"],
            ["3852", "Very Dark Straw", 13, "#af8f12"],
            ["307", "Lemon", 14, "#ede31d"],
            ["444", "Dark Lemon", 14, "#e7cb04"],
            ["445", "Light Lemon", 14, "#f3f487"],
            ["606", "Bright Orange-Red", 14, "#cf1311"],
            ["608", "Bright Orange", 14, "#e5330b"],
            ["725", "Middle Light Topaz", 14, "#e5be39"],
            ["726", "Light Topaz", 14, "#f1d746"],
            ["727", "Very Light Topaz", 14, "#f1eb84"],
            ["740", "Tangerine", 14, "#f16406"],
            ["741", "Middle Tangerine", 14, "#ed7d07"],
            ["742", "Light Tangerine", 14, "#e9a611"],
            ["743", "Middle Yellow", 14, "#f1c939"],
            ["744", "Pale Yellow", 14, "#f3de74"],
            ["745", "Light Pale Yellow", 14, "#eee398"],
            ["900", "Dark Burnt Orange", 14, "#b01f0f"],
            ["946", "Middle Burnt Orange", 14, "#d33e0e"],
            ["947", "Burnt Orange", 14, "#ed4a08"],
            ["967", "Very Light Apricot", 14, "#f6c0ac"],
            ["970", "Light Pumpkin", 14, "#f56510"],
            ["971", "Pumpkin", 14, "#ef6206"],
            ["972", "Deep Canary", 14, "#e8a606"],
            ["973", "Bright Canary", 14, "#ecd20e"],
            ["3078", "Very Light Golden Yellow", 14, "#efeea0"],
            ["3340", "Middle Apricot", 14, "#e9673f"],
            ["3341", "Apricot", 14, "#f08b6b"],
            ["3824", "Light Apricot", 14, "#ec9c84"],
            ["300", "Very Dark Mahogany", 15, "#501d11"],
            ["301", "Middle Mahogany", 15, "#884015"],
            ["400", "Dark Mahogany", 15, "#702b12"],
            ["402", "Very Light Mahogany", 15, "#cf895c"],
            ["720", "Dark Orange Spice", 15, "#bd3a0d"],
            ["721", "Middle Orange Spice", 15, "#d3591d"],
            ["722", "Light Orange Spice", 15, "#e48a51"],
            ["918", "Dark Red Copper", 15, "#711a17"],
            ["919", "Red Copper", 15, "#831914"],
            ["920", "Middle Copper", 15, "#942f1a"],
            ["921", "Copper", 15, "#ab4e23"],
            ["922", "Light Copper", 15, "#c06530"],
            ["945", "Tawny", 15, "#d6bc9b"],
            ["951", "Light Tawny", 15, "#e1cfb4"],
            ["3770", "Very Light Tawny", 15, "#ebe0ca"],
            ["3776", "Light Mahogany", 15, "#b55f32"],
            ["3823", "Ultra Pale Yellow", 15, "#efedc7"],
            ["3825", "Pale Pumpkin", 15, "#e69d69"],
            ["3853", "Dark Autumn Gold", 15, "#c76f24"],
            ["3854", "Middle Autumn Gold", 15, "#dd9d4a"],
            ["3855", "Light Autumn Gold", 15, "#edcf7f"],
            ["3856", "Ultra Very Light Mahogany", 15, "#debe8f"],
            ["355", "Dark Terra Cotta", 16, "#76101b"],
            ["356", "Middle Terra Cotta", 16, "#a75848"],
            ["407", "Dark Desert Sand", 16, "#a77f6a"],
            ["632", "Ultra Very Dark Desert Sand", 16, "#693e2e"],
            ["754", "Light Peach", 16, "#ddaf96"],
            ["758", "Very Light Terra Cotta", 16, "#ce947a"],
            ["948", "Very Light Peach", 16, "#e2d0bb"],
            ["950", "Light Desert Sand", 16, "#cbb195"],
            ["975", "Dark Golden Brown", 16, "#683013"],
            ["976", "Middle Golden Brown", 16, "#ae6d1c"],
            ["977", "Light Golden Brown", 16, "#ca9447"],
            ["3064", "Desert Sand", 16, "#ab7d60"],
            ["3771", "Ultra Very Light Terra Cotta", 16, "#d39c7a"],
            ["3772", "Very Dark Desert Sand", 16, "#865c47"],
            ["3773", "Middle Desert Sand", 16, "#a47e69"],
            ["3774", "Very Light Desert Sand", 16, "#d9c7b0"],
            ["3777", "Very Dark Terra Cotta", 16, "#6d0a17"],
            ["3778", "Light Terra Cotta", 16, "#b66e5a"],
            ["3779", "Ultra Very Light Terra Cotta", 16, "#d6a798"],
            ["3826", "Golden Brown", 16, "#985a1a"],
            ["3827", "Pale Golden Brown", 16, "#d0a35f"],
            ["3830", "Terra Cotta", 16, "#96322f"],
            ["3857", "Dark Rosewood", 16, "#421115"],
            ["3858", "Middle Rosewood", 16, "#65262c"],
            ["3859", "Light Rosewood", 16, "#9d6156"],
            ["433", "Middle Brown", 17, "#5a3313"],
            ["434", "Light Brown", 17, "#774c16"],
            ["435", "Very Light Brown", 17, "#966527"],
            ["436", "Tan", 17, "#a9793c"],
            ["437", "Light Tan", 17, "#bc9c62"],
            ["451", "Dark Shell Gray", 17, "#716764"],
            ["452", "Middle Shell Gray", 17, "#9d9492"],
            ["453", "Light Shell Gray", 17, "#aeada5"],
            ["543", "Ultra Very Light Beige Brown", 17, "#c9bdae"],
            ["712", "Cream", 17, "#e3e3d0"],
            ["738", "Very Light Tan", 17, "#c4b07c"],
            ["739", "Ultra Very Light Tan", 17, "#dad2ad"],
            ["779", "Dark Cocoa", 17, "#503936"],
            ["801", "Dark Coffee Brown", 17, "#472717"],
            ["898", "Very Dark Coffee Brown", 17, "#362112"],
            ["938", "Ultra Dark Coffee Brown", 17, "#251711"],
            ["3031", "Very Dark Mocha Brown", 17, "#342b1f"],
            ["3371", "Black Brown", 17, "#120d0e"],
            ["3860", "Cocoa", 17, "#5f4644"],
            ["3861", "Light Cocoa", 17, "#837471"],
            ["3862", "Dark Mocha Beige", 17, "#6a4f31"],
            ["3863", "Middle Mocha Beige", 17, "#81644a"],
            ["3864", "Light Mocha Beige", 17, "#a39376"],
            ["B5200", "Snow White", 18, "#fcfdfd"],
            ["Blanc", "White", 18, "#fcfdfc"],
            ["Ecru", "Ecru", 18, "#dfe0ca"],
            ["535", "Very Light Ash Gray", 18, "#414e4b"],
            ["640", "Very Dark Beige Gray", 18, "#61664c"],
            ["642", "Dark Beige Gray", 18, "#7a7f62"],
            ["644", "Middle Beige Gray", 18, "#b3b7a0"],
            ["822", "Light Beige Gray", 18, "#cccdb8"],
            ["838", "Very Dark Beige Brown", 18, "#291f19"],
            ["839", "Dark Beige Brown", 18, "#443227"],
            ["840", "Middle Beige Brown", 18, "#6f654b"],
            ["841", "Light Beige Brown", 18, "#90836b"],
            ["842", "Very Light Beige Brown", 18, "#b6ae95"],
            ["3021", "Very Dark Brown Gray", 18, "#2e3124"],
            ["3022", "Middle Brown Gray", 18, "#64775e"],
            ["3023", "Light Brown Gray", 18, "#8e9781"],
            ["3024", "Very Light Brown Gray", 18, "#adb6ab"],
            ["3032", "Middle Mocha Brown", 18, "#868868"],
            ["3033", "Very Light Mocha Brown", 18, "#c4c7b4"],
            ["3781", "Dark Mocha Brown", 18, "#423b25"],
            ["3782", "Light Mocha Brown", 18, "#9d9a7b"],
            ["3787", "Dark Brown Gray", 18, "#3e4636"],
            ["3790", "Ultra Dark Beige Gray", 18, "#6a5d47"],
            ["3865", "Winter White", 18, "#f8f9f4"],
            ["3866", "Ultra Very Light Mocha Brown", 18, "#d0d3c6"],
            ["168", "Very Light Pewter", 19, "#9fafb3"],
            ["169", "Light Pewter", 19, "#637a7c"],
            ["310", "Black", 19, "#0a0b0e"],
            ["317", "Pewter Gray", 19, "#3e4f5f"],
            ["318", "Light Steel Gray", 19, "#7f8799"],
            ["413", "Dark Pewter Gray", 19, "#283b40"],
            ["414", "Dark Steel Gray", 19, "#606a78"],
            ["415", "Pearl Gray", 19, "#a0acb3"],
            ["645", "Very Dark Beaver Gray", 19, "#4e5d52"],
            ["646", "Dark Beaver Gray", 19, "#687663"],
            ["647", "Middle Beaver Gray", 19, "#859783"],
            ["648", "Light Beaver Gray", 19, "#9fa498"],
            ["762", "Very Light Pearl Gray", 19, "#d4dbd9"],
            ["844", "Ultra Dark Beaver Gray", 19, "#2c332f"],
            ["3072", "Very Light Beaver Gray", 19, "#b8c7bb"],
            ["3799", "Very Dark Pewter Gray", 19, "#1c2628"],
        ];
        this.colours = {};
        this.colourIndex = {};
        this.colourTable = [];
        for (var a in e) {
            var g = e[a];
            if (g.length >= 4) {
                var d = g[0].toLowerCase();
                var c = g[1];
                var b = g[2];
                var f = g[3];
                this.colours[d] = new DMCColour(d, c, b, f);
                this.colourIndex[f] = this.colours[d];
                this.colourTable.push(this.colours[d])
            }
        }
        this.numColours = e.length
    },
    unquote: function(b) {
        var c = 0;
        if (b[c] == '"') {
            c++
        }
        var a = b.length;
        if (b[a - 1] == '"') {
            a--
        }
        return b.substring(c, a)
    },
    lookup: function(a) {
        if (a[0] == "D") {
            return this.lookup(a.substr(1))
        }
        return this.colours[a.toLowerCase()]
    },
    lookupColour: function(a) {
        return this.colourIndex[a]
    },
    nearest: function(e) {
        var d = new CdoColour(e);
        var a = null;
        var g = 1000000;
        for (var h in this.colours) {
            var b = this.colours[h];
            var f = d.dist(b.cdoColour);
            if (f < g) {
                g = f;
                a = b
            }
        }
        return a
    },
    fromIndex: function(a) {
        return this.colourTable[a].id
    },
};
dmcColours.init();
var dmcTapestryPaletteColourSource = {
    code: "T",
    threshold: 0.5,
    canvas: null,
    ctx: null,
    img: null,
    imgData: null,
    lastId: "",
    numColours: 454,
    strongChoice: false,
    init: function() {
        this.canvas = document.getElementById("dmcTapestryPaletteCanvas");
        if (this.canvas) {
            this.ctx = this.canvas.getContext("2d");
            this.img = document.getElementById("dmcTapestryPaletteImage");
            $(this.img).load(function() {
                dmcTapestryPaletteColourSource.getImage()
            });
            this.getImage();
            this.startMouse()
        }
        this.numColours = dmcTapestryColours.numColours
    },
    getImage: function() {
        this.img = document.getElementById("dmcTapestryPaletteImage");
        this.ctx.drawImage(this.img, 0, 0);
        this.imgData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    },
    fromId: function(b) {
        var a = dmcTapestryColours.lookup(b);
        if (a) {
            return a.colour
        }
        return "#ffffff"
    },
    toId: function(b) {
        var a = dmcTapestryColours.nearest(b);
        if (a) {
            return a.id
        }
        return "#ffffff"
    },
    idName: function(b) {
        var a = dmcTapestryColours.lookup(b);
        if (a) {
            return a.name
        }
        return "unknown DMC Tapestry"
    },
    showId: function(b, a) {},
    activate: function() {
        this.lastId = ""
    },
    moveCapture: false,
    idAt: function(m) {
        var e = $(this.img).offset();
        var l = Math.round(m.clientX - e.left + window.pageXOffset);
        var j = Math.round(m.clientY - e.top + window.pageYOffset);
        if (l < 0 || this.canvas.width <= l || j < 0 || this.canvas.height <= j) {
            this.moveCapture = false;
            MouseMoveCapture.end();
            cdoToolTip.hide();
            return ""
        }
        if (!this.moveCapture) {
            this.moveCapture = true;
            MouseMoveCapture.start({
                self: this
            }, dmcTapestryPaletteColourSource.handleMouseMove)
        }
        var f = (l + j * this.canvas.width) * 4;
        var c = this.imgData.data[f++];
        var h = this.imgData.data[f++];
        var k = this.imgData.data[f];
        var a = rgb2css(c, h, k);
        var d = dmcTapestryColours.lookupColour(a).id;
        return d
    },
    over: function(a) {
        var b = this.idAt(a);
        if (!b) {
            cdoToolTip.hide();
            return ""
        }
        if (b != this.lastId) {
            cdoToolTip.show(a, this.idName(b))
        }
        return b
    },
    select: function(a) {
        var b = this.over(a);
        if (!b) {
            return
        }
        colourSource.setId(b)
    },
    startMouse: function() {
        var a = $(this.img);
        a.mousedown({
            self: this
        }, dmcTapestryPaletteColourSource.handleMouseDown);
        a.on("touchstart", {
            self: this
        }, dmcTapestryPaletteColourSource.handleTouchDown);
        a.mousemove({
            self: this
        }, dmcTapestryPaletteColourSource.handleMouseMove);
        a.on("touchmove", {
            self: this
        }, dmcTapestryPaletteColourSource.handleTouchMove)
    },
    mousedown: false,
    extractTouch: function(a) {
        if (a.originalEvent.touches && a.originalEvent.touches[0]) {
            a.clientX = a.originalEvent.touches[0].clientX;
            a.clientY = a.originalEvent.touches[0].clientY
        }
    },
    handleMouseDown: function(a) {
        var b = a.data.self;
        b.mousedown = true;
        a.preventDefault();
        b.select(a);
        MouseUpCapture.start({
            self: b
        }, dmcTapestryPaletteColourSource.handleMouseUp);
        MouseMoveCapture.start({
            self: b
        }, dmcTapestryPaletteColourSource.handleMouseMove);
        TouchEndCapture.start({
            self: b
        }, dmcTapestryPaletteColourSource.handleTouchUp);
        TouchMoveCapture.start({
            self: b
        }, dmcTapestryPaletteColourSource.handleTouchMove)
    },
    handleTouchDown: function(a) {
        dmcTapestryPaletteColourSource.extractTouch(a);
        dmcTapestryPaletteColourSource.handleMouseDown(a)
    },
    handleMouseMove: function(a) {
        var b = a.data.self;
        if (!b.mousedown) {
            b.over(a);
            return
        }
        a.preventDefault();
        b.select(a)
    },
    handleTouchMove: function(a) {
        dmcTapestryPaletteColourSource.extractTouch(a);
        dmcTapestryPaletteColourSource.handleMouseMove(a)
    },
    handleMouseUp: function(a) {
        var b = a.data.self;
        b.mousedown = false;
        b.moveCapture = false;
        cdoToolTip.hide();
        a.preventDefault();
        MouseUpCapture.end();
        MouseMoveCapture.end();
        TouchEndCapture.end();
        TouchMoveCapture.end();
        b.select(a)
    },
    handleTouchUp: function(a) {
        dmcTapestryPaletteColourSource.extractTouch(a);
        dmcTapestryPaletteColourSource.handleMouseUp(a)
    },
    fromIndex: function(a) {
        return dmcTapestryColours.fromIndex(a)
    },
};
var dmcTapestryNumberColourSource = {
    code: dmcTapestryPaletteColourSource.code,
    threshold: 0.5,
    input: null,
    numColours: 454,
    strongChoice: true,
    init: function() {
        this.input = $("#dmcTapestryNumberInput");
        this.input.change(function() {
            dmcTapestryNumberColourSource.inputChanged()
        });
        $("#dmcTapestryNumberInputSet").click(function() {
            dmcTapestryNumberColourSource.inputChanged()
        });
        this.numColours = dmcTapestryColours.numColours
    },
    fromId: function(b) {
        var a = dmcTapestryColours.lookup(b);
        if (a) {
            return a.colour
        }
        return "#ffffff"
    },
    toId: function(b) {
        var a = dmcTapestryColours.nearest(b);
        if (a) {
            return a.id
        }
        return "#ffffff"
    },
    idName: function(b) {
        var a = dmcTapestryColours.lookup(b);
        if (a) {
            return a.name
        }
        return "unknown DMC Tapestry"
    },
    doNotify: true,
    showId: function(c, a) {
        this.doNotify = false;
        var b = dmcTapestryColours.lookup(c);
        if (b) {
            this.input.val(b.code)
        }
        this.doNotify = true;
        this.showDetails(b, a)
    },
    activate: function() {},
    inputChanged: function() {
        var b = this.input.val();
        var a = dmcTapestryColours.lookup(b);
        if (a) {
            colourSource.id = a.id;
            if (this.doNotify) {
                colourSource.notify(a.id)
            }
        }
        this.showDetails(a, null)
    },
    showDetails: function(e, d) {
        var c = "unknown DMC Tapestry";
        var b = "#ffffff";
        if (e) {
            c = e.colName;
            b = e.colour;
            if (d && e.id != d) {
                c = "Similar to: " + c
            }
        }
        $("#dmcTapestryNumberName").text(c);
        var f = $("#dmcTapestryNumberSample");
        f.css("background-color", b);
        var a = f.position().top;
        f.css("height", 194 - a)
    },
    fromIndex: function(a) {
        return dmcTapestryColours.fromIndex(a)
    },
};

function DMCTapestryColour(c, b, a, d) {
    this.code = c;
    this.id = dmcTapestryPaletteColourSource.code + c;
    this.name = "DMC " + c + "(Tapestry wool), " + b;
    this.colName = b;
    this.card = a;
    this.colour = d;
    this.cdoColour = new CdoColour(d)
}
dmcTapestryColours = {
    colours: null,
    colourIndex: null,
    colourTable: null,
    numColours: 0,
    init: function() {
        var e = [
            ["7106", "Very Dark Melon", 1, "#f3122c"],
            ["7666", "Bright Red", 1, "#ce0913"],
            ["7544", "Red", 1, "#a20308"],
            ["7110", "Dark Red", 1, "#5d0409"],
            ["7003", "Very Light Salmon", 1, "#fc9ea5"],
            ["7004", "Very Light Carnation", 1, "#fd788a"],
            ["7005", "Middle Carnation", 1, "#ea3040"],
            ["7107", "Dark Carnation", 1, "#af0918"],
            ["7108", "Dark Rose", 1, "#8c040e"],
            ["7135", "Geranium", 1, "#f03961"],
            ["7640", "Middle Raspberry", 1, "#cd0a27"],
            ["7138", "Dark Raspberry", 1, "#7f0413"],
            ["7139", "Very Dark Raspberry", 1, "#580410"],
            ["7218", "Very Dark Garnet", 1, "#3a060c"],
            ["7202", "Light Salmon", 1, "#ce7888"],
            ["7194", "Salmon", 1, "#b75b67"],
            ["7195", "Middle Salmon", 1, "#a54451"],
            ["7217", "Middle Shell Pink", 1, "#782f3a"],
            ["7147", "Dark Shell Pink", 1, "#510c14"],
            ["7199", "Very Dark Shell Pink", 1, "#451015"],
            ["7761", "Light Coral", 2, "#e3686e"],
            ["7760", "Light Raspberry", 2, "#c95766"],
            ["7759", "Middle Salmon", 2, "#a93b49"],
            ["7196", "Dark Salmon", 2, "#922a36"],
            ["7758", "Dark Salmon", 2, "#851829"],
            ["7207", "Very Dark Rose", 2, "#600c1c"],
            ["7133", "Very Light Dusty Rose", 2, "#f990af"],
            ["7605", "Light Cranberry", 2, "#f06b99"],
            ["7804", "Cranberry", 2, "#d24b7c"],
            ["7603", "Middle Cranberry", 2, "#d23368"],
            ["7136", "Rose", 2, "#c01336"],
            ["7600", "Very Dark Cranberry", 2, "#af072f"],
            ["7151", "Light Mauve", 2, "#ec85ae"],
            ["7204", "Middle Mauve", 2, "#cb5d83"],
            ["7205", "Mauve", 2, "#a1315a"],
            ["7210", "Dark Mauve", 2, "#6c1635"],
            ["7212", "Very Dark Mauve", 2, "#490b1e"],
            ["7375", "Dark Garnet", 2, "#240b17"],
            ["7372", "Black Brown", 2, "#190e10"],
            ["7221", "Very Light Shell Pink", 3, "#cb9195"],
            ["7223", "Middle Light Shell Pink", 3, "#a46d73"],
            ["7226", "Light Shell Pink", 3, "#783747"],
            ["7260", "Very Light Antique Mauve", 3, "#c5a7b3"],
            ["7262", "Light Cocoa", 3, "#987584"],
            ["7266", "Cocoa", 3, "#4d3141"],
            ["7268", "Middle Antique Violet", 3, "#2c1e30"],
            ["7119", "Dark Rosewood", 3, "#230b13"],
            ["7251", "Very Light Antique Mauve", 3, "#c891a8"],
            ["7253", "Light Antique Mauve", 3, "#9a6080"],
            ["7014", "Middle Grape", 3, "#754372"],
            ["7153", "Light Plum", 3, "#ac3571"],
            ["7157", "Middle Plum", 3, "#690730"],
            ["7255", "Middle Antique Mauve", 3, "#7e3b6f"],
            ["7257", "Dark Grape", 3, "#400a2f"],
            ["7016", "Very Dark Grape", 3, "#230c26"],
            ["7024", "Middle Lavender", 3, "#be81c4"],
            ["7896", "Dark Lavender", 3, "#a164b2"],
            ["7025", "Very Dark Lavender", 3, "#784b9a"],
            ["7895", "Middle Blue Violet", 3, "#643f87"],
            ["7026", "Middle Dark Blue Violet", 3, "#4d3579"],
            ["7017", "Very Dark Violet", 3, "#31134b"],
            ["7711", "Middle Blue Violet", 4, "#7b6ebd"],
            ["7243", "Dark Blue Violet", 4, "#433f92"],
            ["7245", "Very Dark Cornflower Blue", 4, "#111153"],
            ["7790", "Very Light Antique Mauve", 4, "#b393a7"],
            ["7722", "Very Light Antique Violet", 4, "#ac96aa"],
            ["7244", "Light Antique Violet", 4, "#7f7395"],
            ["7241", "Middle Dark Blue Violet", 4, "#6a6292"],
            ["7022", "Very Dark Blue Violet", 4, "#271949"],
            ["7023", "Dark Navy Blue", 4, "#07081a"],
            ["7019", "Light Blue Violet", 4, "#5e65af"],
            ["7020", "Middle Light Blue Violet", 4, "#484b9b"],
            ["7031", "Very Light Cornflower Blue", 4, "#8b96cd"],
            ["7018", "Light Cornflower Blue", 4, "#6e80c4"],
            ["7033", "Middle Blue", 4, "#314f89"],
            ["7034", "Very Dark Blue", 4, "#091b48"],
            ["7028", "Light Lavender Blue", 4, "#6881bf"],
            ["7798", "Middle Lavender Blue", 4, "#516ebb"],
            ["7029", "Dark Lavender Blue", 4, "#374b9a"],
            ["7030", "Dark Delft Blue", 4, "#203372"],
            ["7319", "Royal Blue", 4, "#0e1a56"],
            ["7800", "Ultra Very Light Blue", 5, "#abcde9"],
            ["7035", "Delft Blue", 5, "#6792e1"],
            ["7314", "Middle Delft Blue", 5, "#4776d2"],
            ["7317", "Dark Blue", 5, "#1c499d"],
            ["7318", "Very Dark Blue", 5, "#0e2e7a"],
            ["7307", "Navy Blue", 5, "#0a1239"],
            ["7308", "Very Dark Navy Blue", 5, "#0a0b1c"],
            ["7797", "Dark Royal Blue", 5, "#162795"],
            ["7796", "Very Dark Royal Blue", 5, "#0d1b83"],
            ["7823", "Ultra Very Dark Baby Blue", 5, "#0a144f"],
            ["7298", "Light Sky Blue", 5, "#a3c4d6"],
            ["7313", "Sky Blue", 5, "#7599d1"],
            ["7316", "Dark Wedgewood", 5, "#285cae"],
            ["7311", "Dark Wedgwood", 5, "#0a2363"],
            ["7336", "Middle Navy Blue", 5, "#0c1d44"],
            ["7299", "Very Dark Antique Blue", 5, "#0d1531"],
            ["7799", "Very Light Blue", 5, "#86a4d8"],
            ["7302", "Very Light Antique Blue", 5, "#6f96c7"],
            ["7802", "Light Antique Blue", 5, "#5b85b2"],
            ["7304", "Middle Antique Blue", 5, "#48739f"],
            ["7306", "Dark Antique Blue", 5, "#244170"],
            ["7284", "Light Gray Blue", 6, "#8b94b2"],
            ["7555", "Middle Gray Blue", 6, "#5d6e92"],
            ["7027", "Ultra Very Light Baby Blue", 6, "#a9b9ca"],
            ["7594", "Very Light Baby Blue", 6, "#7c8fa3"],
            ["7593", "Light Antique Blue", 6, "#566c89"],
            ["7591", "Dark Antique Blue", 6, "#213656"],
            ["7297", "Very Dark Antique Blue", 6, "#152745"],
            ["7036", "Light Bright Turquoise", 6, "#43a3ca"],
            ["7037", "Middle Bright", 6, "#2087c2"],
            ["7038", "Dark Bright Turquoise", 6, "#0a50a0"],
            ["7996", "Middle Wedgewood", 6, "#2f74be"],
            ["7995", "Electric Blue", 6, "#215fb1"],
            ["7650", "Very Dark Peacock Blue", 6, "#17488d"],
            ["7301", "Very Light Sky Blue", 6, "#96b7ca"],
            ["7294", "Middle Gray Green", 6, "#495d6b"],
            ["7592", "Middle Antique Blue", 6, "#2f4860"],
            ["7339", "Very Dark Gray Green", 6, "#212936"],
            ["7292", "Very Light Pewter", 6, "#8892a0"],
            ["7285", "Light Pewter", 6, "#6d7482"],
            ["7287", "Light Antique Blue", 6, "#516074"],
            ["7599", "Very Light Turquoise", 7, "#9fc8ce"],
            ["7597", "Turquoise", 7, "#6095b4"],
            ["7296", "Very Dark Turquoise", 7, "#1c3950"],
            ["7288", "Ultra Very Dark Turquoise", 7, "#16233b"],
            ["7289", "Very Dark Gray Green", 7, "#0d1420"],
            ["7828", "Very Light Gray Green", 7, "#98b3bd"],
            ["7927", "Light Gray Green", 7, "#5c7883"],
            ["7690", "Middle Gray Green", 7, "#46616f"],
            ["7926", "Dark Turquoise", 7, "#2d4d60"],
            ["7860", "Ultra Very Dark Turquoise", 7, "#0d2846"],
            ["7928", "Very Light Beaver Gray", 7, "#afbcb0"],
            ["7322", "Light Blue Green", 7, "#90a59f"],
            ["7323", "Light Blue Green", 7, "#7d918e"],
            ["7326", "Blue Green", 7, "#3c575a"],
            ["7327", "Dark Blue Green", 7, "#263d43"],
            ["7329", "Dark Blue Green", 7, "#203439"],
            ["7999", "Very Dark Blue Green", 7, "#151d24"],
            ["7598", "Light Turquoise", 7, "#6093a1"],
            ["7956", "Dark Seagreen", 7, "#478f81"],
            ["7861", "Light Teal Green", 7, "#44748a"],
            ["7596", "Dark Teal Green", 7, "#205865"],
            ["7704", "Very Light Fern Green", 8, "#98a597"],
            ["7404", "Fern Green", 8, "#72846e"],
            ["7702", "Blue Green", 8, "#435653"],
            ["7408", "Very Dark Pistachio Green", 8, "#1d2e31"],
            ["7429", "Very Dark Blue Green", 8, "#142124"],
            ["7510", "Light Beige Gray", 8, "#c5bca9"],
            ["7321", "Light Brown Gray", 8, "#96978b"],
            ["7331", "Very Light Beaver Gray", 8, "#807e72"],
            ["7039", "Dark Beaver Gray", 8, "#54514e"],
            ["7337", "Very Dark Beaver Gray", 8, "#313940"],
            ["7912", "Light Emerald Green", 8, "#53a080"],
            ["7911", "Middle Emerald Green", 8, "#2c7547"],
            ["7909", "Dark Emerald Green", 8, "#1b543f"],
            ["7604", "Light Nile Green", 8, "#8db39a"],
            ["7542", "Light Pistachio Green", 8, "#4a735e"],
            ["7541", "Dark Pistachio Green", 8, "#264037"],
            ["7389", "Very Dark Pistachio Green", 8, "#10211e"],
            ["7386", "Middle Forest Green", 8, "#3c5b3a"],
            ["7385", "Dark Forest Green", 8, "#233a28"],
            ["7540", "Very Dark Forest Green", 8, "#1e3329"],
            ["7040", "Very Light Yellow Green", 9, "#c6daa3"],
            ["7369", "Light Fern Green", 9, "#9ab091"],
            ["7370", "Pine Green", 9, "#66805f"],
            ["7406", "Dark Pistachio Green", 9, "#446054"],
            ["7428", "Very Dark Hunter Green", 9, "#21362b"],
            ["7398", "Dark Avocado Green", 9, "#1f2c2a"],
            ["7041", "Light Forest Green", 9, "#8bb773"],
            ["7042", "Light Green", 9, "#51824c"],
            ["7043", "Bright Green", 9, "#224e25"],
            ["7348", "Green", 9, "#18381b"],
            ["7340", "Light Parrot Green", 9, "#adcd5b"],
            ["7341", "Bright Chartreuse", 9, "#88b139"],
            ["7342", "Middle Parrot Green", 9, "#658b17"],
            ["7344", "Dark Parrot Green", 9, "#43721b"],
            ["7346", "Very Dark Parrot Green", 9, "#2b5722"],
            ["7382", "Very Light Yellow Green", 9, "#9ab777"],
            ["7384", "Forest Green", 9, "#6a855a"],
            ["7320", "Dark Forest Green", 9, "#3e5a3b"],
            ["7347", "Very Dark Forest Green", 9, "#203326"],
            ["7772", "Ultra Light Avocado Green", 10, "#becf7f"],
            ["7771", "Very Light Avocado Green", 10, "#a1bd64"],
            ["7770", "Very Light Avocado Green", 10, "#708b35"],
            ["7769", "Light Avocado Green", 10, "#617a34"],
            ["7045", "Avocado Green", 10, "#435f2a"],
            ["7549", "Light Moss Green", 10, "#c0d169"],
            ["7548", "Middle Light Moss Green", 10, "#99a948"],
            ["7988", "Middle Avocado Green", 10, "#465e18"],
            ["7367", "Very Dark Avocado Green", 10, "#2d3b19"],
            ["7424", "Light Khaki Green", 10, "#868860"],
            ["7376", "Middle Khaki Green", 10, "#555e3b"],
            ["7427", "Middle Pine Green", 10, "#344327"],
            ["7890", "Dark Pine Green", 10, "#2a381c"],
            ["7351", "Very Light Golden Yellow", 10, "#ded178"],
            ["7584", "Light Moss Green", 10, "#c2bd3d"],
            ["7583", "Light Olive Green", 10, "#938e3a"],
            ["7363", "Golden Olive", 10, "#7c7031"],
            ["7364", "Olive Green", 10, "#666432"],
            ["7420", "Off White", 11, "#f3edb9"],
            ["7422", "Light Khaki Green", 11, "#c6c47d"],
            ["7361", "Light Khaki Green", 11, "#aaaa6c"],
            ["7362", "Light Mustard", 11, "#83814e"],
            ["7426", "Light Mustard", 11, "#545537"],
            ["7377", "Dark Khaki Green", 11, "#3a3b24"],
            ["7379", "Dark Green Gray", 11, "#2d3228"],
            ["7400", "Middle Beige Gray", 11, "#c8c9a2"],
            ["7870", "Light Brown Gray", 11, "#828672"],
            ["7392", "Middle Brown Gray", 11, "#5a5e4b"],
            ["7396", "Dark Green Gray", 11, "#31362a"],
            ["7470", "Very Light Golden Yellow", 11, "#e4d075"],
            ["7353", "Very Light Golden Olive", 11, "#8a752b"],
            ["7582", "Middle Mustard", 11, "#645711"],
            ["7676", "Very Dark Straw", 11, "#785e13"],
            ["7425", "Dark Golden Olive", 11, "#302a10"],
            ["7391", "Dark Golden Olive", 11, "#433c2b"],
            ["7359", "Very Dark Brown Gray", 11, "#2f2d21"],
            ["7371", "Very Light Drab Brown", 12, "#beb38d"],
            ["7048", "Light Drab Brown", 12, "#806d46"],
            ["7355", "Dark Drab Brown", 12, "#5b4b23"],
            ["7417", "Dark Mocha Brown", 12, "#2a2318"],
            ["7049", "Very Light Golden Yellow", 12, "#fcf773"],
            ["7431", "Very Light Topaz", 12, "#fdf559"],
            ["7726", "Light Topaz", 12, "#fdda2b"],
            ["7433", "Lemon", 12, "#fef411"],
            ["7435", "Bright Canary", 12, "#fece0c"],
            ["7785", "Middle Light Topaz", 12, "#f5bc11"],
            ["7484", "Topaz", 12, "#c28214"],
            ["7485", "Dark Topaz", 12, "#7d5512"],
            ["7487", "Ultra Very Dark Topaz", 12, "#5e4118"],
            ["7501", "Ultra Very Light Tan", 12, "#cab587"],
            ["7493", "Light Hazelnut Brown", 12, "#a2885f"],
            ["7423", "Hazelnut Brown", 12, "#886a47"],
            ["7524", "Dark Hazelnut Brown", 12, "#6b5035"],
            ["7490", "Very Dark Hazelnut Brown", 12, "#47321e"],
            ["7491", "Ultra Very Light Tan", 13, "#e9d1a9"],
            ["7724", "Very Light Tan", 13, "#caa47a"],
            ["7494", "Light Tan", 13, "#a07848"],
            ["7421", "Very Light Brown", 13, "#8f5e31"],
            ["7477", "Light Brown", 13, "#805127"],
            ["7499", "Middle Brown", 13, "#4f2e19"],
            ["7905", "Light Pale Yellow", 13, "#feed9c"],
            ["7503", "Light Old Gold", 13, "#e1b672"],
            ["7472", "Light Straw", 13, "#e7b955"],
            ["7504", "Straw", 13, "#e6b23d"],
            ["7473", "Topaz", 13, "#d49e37"],
            ["7505", "Middle Topaz", 13, "#c28024"],
            ["7783", "Dark Topaz", 13, "#b66e15"],
            ["7780", "Ultra Very Dark Topaz", 13, "#91501d"],
            ["7746", "Ultra Very Light Tan", 13, "#fbe0b0"],
            ["7453", "Very Light Tan", 13, "#ebc291"],
            ["7739", "Light Tawny", 13, "#e0af81"],
            ["7058", "Pale Golden Brown", 13, "#f0a355"],
            ["7455", "Tan", 13, "#bc7f41"],
            ["7506", "Light Golden Brown", 13, "#b16d30"],
            ["7767", "Middle Golden Brown", 13, "#a65c1f"],
            ["7508", "Golden Brown", 13, "#9a542d"],
            ["7078", "Light Pale Yellow", 14, "#fce673"],
            ["7055", "Pale Yellow", 14, "#fdcc4e"],
            ["7725", "Middle Light Topaz", 14, "#f0a735"],
            ["7056", "Deep Canary", 14, "#e18709"],
            ["7057", "Middle Golden Brown", 14, "#c56b07"],
            ["7444", "Light Mahogany", 14, "#973a0d"],
            ["7457", "Middle Mahogany", 14, "#7a2a0f"],
            ["7917", "Ultra Very Light Mahogany", 14, "#e29862"],
            ["7918", "Very Light Mahogany", 14, "#c6622f"],
            ["7919", "LT Orange Spice", 14, "#c55320"],
            ["7922", "Light Copper", 14, "#9d2a0b"],
            ["7446", "Middle Copper", 14, "#801f12"],
            ["7178", "Dark Red Copper", 14, "#53100a"],
            ["7459", "Very Dark Mahogany", 14, "#43120a"],
            ["7214", "Light Orange Spice", 14, "#ce4b33"],
            ["7125", "Middle Burnt Orange", 14, "#be291c"],
            ["7920", "Dark Burnt Orange", 14, "#9f120e"],
            ["7184", "Red Copper", 14, "#710a0f"],
            ["7946", "Bright Orange", 14, "#ea2014"],
            ["7606", "Bright Orange-Red", 14, "#e00e0b"],
            ["BLANC", "White", 15, "#fefef7"],
            ["ECRU", "Ecru", 15, "#fefbe0"],
            ["7745", "Light Pale Yellow", 15, "#fdee8c"],
            ["7727", "Pale Yellow", 15, "#fed95f"],
            ["7971", "Deep Canary", 15, "#fca209"],
            ["7436", "Light Tangerine", 15, "#fd8a0a"],
            ["7740", "Light Pumpkin", 15, "#f85b08"],
            ["7947", "Burnt Orange", 15, "#e6380e"],
            ["7050", "Light Tangerine", 15, "#fc9a34"],
            ["7051", "Middle Tangerine", 15, "#fb6b0f"],
            ["7439", "Middle Orange Spice", 15, "#c82b0b"],
            ["7360", "Dark Orange Spice", 15, "#961c09"],
            ["7303", "Middle Copper", 15, "#740f0b"],
            ["7127", "Dark Terra Cotta", 15, "#71080d"],
            ["7008", "Very Dark Terra Cotta", 15, "#660c11"],
            ["7853", "Peach", 15, "#f8a799"],
            ["7852", "Middle Melon", 15, "#f87b70"],
            ["7851", "Light Coral", 15, "#f35751"],
            ["7850", "Coral", 15, "#df352f"],
            ["7171", "Very Light Tawny", 16, "#fcd8b2"],
            ["7173", "Ultra Very Light Mahogany", 16, "#f9a872"],
            ["7144", "Ultra Very Light Terra Cotta", 16, "#e28b68"],
            ["7174", "Light Terra Cotta", 16, "#c27256"],
            ["7175", "Very Light Mahogany", 16, "#db7351"],
            ["7176", "Copper", 16, "#9d412a"],
            ["7700", "Dark Golden Brown", 16, "#69260f"],
            ["7191", "Very Light Peach", 16, "#fadcc9"],
            ["7121", "Light Peach", 16, "#f1b6a7"],
            ["7010", "Light Terra Cotta", 16, "#d47268"],
            ["7124", "Middle Terra Cotta", 16, "#d26255"],
            ["7356", "Terra Cotta", 16, "#99342c"],
            ["7168", "Terra Cotta", 16, "#7d2d28"],
            ["7447", "Dark Terra Cotta", 16, "#69100e"],
            ["7192", "Ultra Very Light Terra Cotta", 16, "#eca19a"],
            ["7193", "Very Light Shell Pink", 16, "#c57779"],
            ["7165", "Light Rosewood", 16, "#8f4a4b"],
            ["7169", "Middle Rosewood", 16, "#571d1d"],
            ["7179", "Very Light Peach", 17, "#ebb39c"],
            ["7164", "Ultra Very Light Terra Cotta", 17, "#de987e"],
            ["7123", "Ultra Very Light Terra Cotta", 17, "#d17e73"],
            ["7166", "Light Terra Cotta", 17, "#b15c4f"],
            ["7632", "Ultra Very Dark Desert Sand", 17, "#713735"],
            ["7170", "Very Light Desert Sand", 17, "#f4d8c3"],
            ["7162", "Light Mocha Beige", 17, "#c49d8a"],
            ["7064", "Pine Green", 17, "#895747"],
            ["7466", "Very Dark Desert Sand", 17, "#6e4032"],
            ["7432", "Ultra Very Dark Desert Sand", 17, "#532c28"],
            ["7938", "Very Dark Coffee Brown", 17, "#341712"],
            ["7469", "Black Brown", 17, "#211111"],
            ["7460", "Very Light Peach", 17, "#e7bdaf"],
            ["7120", "Light Peach", 17, "#d8a89f"],
            ["7543", "Light Desert Sand", 17, "#c99e96"],
            ["7949", "Dark Desert Sand", 17, "#996564"],
            ["7840", "Ultra Very Dark Desert Sand", 17, "#69393a"],
            ["7230", "Light Mocha Beige", 17, "#be9a8c"],
            ["7232", "Light Cocoa", 17, "#8b6c70"],
            ["7234", "Light Cocoa", 17, "#74565d"],
            ["7236", "Cocoa", 17, "#58373c"],
            ["7801", "Dark Cocoa", 17, "#341e1f"],
            ["7141", "Ultra Very Light Beige Brown", 18, "#dec6ab"],
            ["7461", "Light Mocha Beige", 18, "#d0ab91"],
            ["7463", "Middle Mocha Beige", 18, "#a67c68"],
            ["7465", "Dark Mocha Beige", 18, "#845946"],
            ["7060", "Light Brown", 18, "#6e402c"],
            ["7479", "Dark Coffee Brown", 18, "#3f1d0e"],
            ["7489", "Ultra Dark Coffee Brown", 18, "#341a14"],
            ["7452", "Very Light Desert Sand", 18, "#d3af95"],
            ["7143", "Light Tan", 18, "#d09f79"],
            ["7059", "Very Light Brown", 18, "#945533"],
            ["7845", "Light Brown", 18, "#71401f"],
            ["7497", "Middle Brown", 18, "#512b12"],
            ["7492", "Very Light Old Gold", 18, "#d0b68d"],
            ["7511", "Very Light Tan", 18, "#a68565"],
            ["7513", "Hazelnut Brown", 18, "#7b583b"],
            ["7514", "Dark Mocha Beige", 18, "#583a2a"],
            ["7411", "Very Light Beige Brown", 18, "#aa9280"],
            ["7413", "Light Beige Brown", 18, "#776051"],
            ["7525", "Middle Mocha Beige", 18, "#654b35"],
            ["7488", "Dark Coffee Brown", 18, "#3b2314"],
            ["7533", "Very Dark Mocha Brown", 18, "#2d2122"],
            ["7390", "Light Mocha Brown", 19, "#938878"],
            ["7415", "Ultra Dark Beige Gray", 19, "#645545"],
            ["7416", "Dark Mocha Brown", 19, "#413129"],
            ["7515", "Very Dark Mocha Brown", 19, "#18110a"],
            ["7535", "Black Brown", 19, "#110c0f"],
            ["7500", "Ultra Very Light Mocha Brown", 19, "#dcc8b7"],
            ["7520", "Very Light Beige Brown", 19, "#a58e83"],
            ["7521", "Light Beige Brown", 19, "#93786c"],
            ["7519", "Middle Beige Brown", 19, "#886f64"],
            ["7518", "Dark Mocha Beige", 19, "#614237"],
            ["7467", "Dark Beige Brown", 19, "#391f15"],
            ["7280", "Light Shell Gray", 19, "#b2a6ac"],
            ["7065", "Middle Shell Gray", 19, "#9b8a89"],
            ["7271", "Very Light Beige Brown", 19, "#ac9a93"],
            ["7509", "Light Beige Brown", 19, "#8d7e79"],
            ["7273", "Dark Shell Gray", 19, "#77696b"],
            ["7066", "Dark Shell Gray", 19, "#443c49"],
            ["7558", "Light Shell Gray", 20, "#8f8c9e"],
            ["7617", "Middle Shell Gray", 20, "#807784"],
            ["7275", "Dark Shell Gray", 20, "#554a53"],
            ["7538", "Very Dark Pewter Gray", 20, "#121115"],
            ["7715", "Very Light Pearl Gray", 20, "#a7adc3"],
            ["7068", "Light Steel Gray", 20, "#474d65"],
            ["7705", "Dark Steel Gray", 20, "#2d3143"],
            ["7713", "Pewter Gray", 20, "#1f202d"],
            ["7618", "Pearl Gray", 20, "#716f78"],
            ["7620", "Light Steel Gray", 20, "#55535d"],
            ["7626", "Dark Steel Gray", 20, "#423f4a"],
            ["7622", "Pewter Gray", 20, "#2f2a36"],
            ["7624", "Very Dark Pewter Gray", 20, "#0e0c15"],
            ["NOIR", "Black", 20, "#040407"],
            ["7282", "Light Beaver Gray", 20, "#8b898d"]
        ];
        this.colours = {};
        this.colourIndex = {};
        this.colourTable = [];
        for (var a in e) {
            var g = e[a];
            if (g.length >= 4) {
                var d = g[0].toLowerCase();
                var c = g[1];
                var b = g[2];
                var f = g[3];
                this.colours[d] = new DMCTapestryColour(d, c, b, f);
                this.colourIndex[f] = this.colours[d];
                this.colourTable.push(this.colours[d])
            }
        }
        this.numColours = e.length
    },
    unquote: function(b) {
        var c = 0;
        if (b[c] == '"') {
            c++
        }
        var a = b.length;
        if (b[a - 1] == '"') {
            a--
        }
        return b.substring(c, a)
    },
    lookup: function(a) {
        if (a[0] == dmcTapestryPaletteColourSource.code) {
            return this.lookup(a.substr(1))
        }
        return this.colours[a.toLowerCase()]
    },
    lookupColour: function(a) {
        return this.colourIndex[a]
    },
    nearest: function(e) {
        var d = new CdoColour(e);
        var a = null;
        var g = 1000000;
        for (var h in this.colours) {
            var b = this.colours[h];
            var f = d.dist(b.cdoColour);
            if (f < g) {
                g = f;
                a = b
            }
        }
        return a
    },
    fromIndex: function(a) {
        return this.colourTable[a].id
    },
};
dmcTapestryColours.init();
var cdoPalette = {
    canvas: null,
    currentIndex: 0,
    minColours: 2,
    maxColours: 150,
    defaultNumColours: 24,
    colours: new Array(this.maxColours),
    numColours: 24,
    rows: 0,
    cols: 0,
    blobRadius: 0,
    lastUnusedIndex: 0,
    sizeField: null,
    backgroundColourCheck: null,
    hasBackgroundColour: true,
    lastActionEnum: {
        CHANGE_INDEX: 0,
        COLOUR_USED: 1,
    },
    lastAction: 1,
    init: function(b, a) {
        DesIO.register("PL", function(c) {
            cdoPalette.fromString(c)
        }, function() {
            return cdoPalette.toString()
        });
        this.canvas = b;
        if (b) {
            this.context = this.canvas.getContext("2d");
            this.sizeField = new NumberField("#paletteSize", function(c) {
                cdoPalette.sizeFieldChanged(c)
            }, 800);
            this.setHasBackgroundColour(true);
            this.defaultNumColours = this.sizeField.value();
            this.numColours = a ? a : this.defaultNumColours;
            this.backgroundColourCheck = $("#backgroundColourCheck");
            this.backgroundColourCheck.prop("checked", this.hasBackgroundColour);
            this.backgroundColourCheck.change(function() {
                cdoPalette.backgroundColourCheckChange()
            });
            this.startMouse()
        }
        this.reset()
    },
    reset: function() {
        this.currentIndex = 0;
        this.colours = new Array(this.maxColours);
        for (var a = 0; a < this.maxColours; a++) {
            this.colours[a] = new PaletteBlob(a, 0, {
                x: 0,
                y: 0
            })
        }
        this.checkUsedColours();
        this.draw();
        this.setFormValues()
    },
    setNumColours: function(a) {
        if (a == this.numColours) {
            return
        }
        if (a <= this.currentIndex) {
            this.setCurrentIndex(0)
        }
        this.numColours = a;
        this.checkUsedColours();
        AutoSave.save("quiet");
        this.draw()
    },
    checkUsedColours: function() {
        var f = 0;
        var e = 0;
        for (var d = 0; d < this.maxColours; d++) {
            if (this.colours[d].usage) {
                f++;
                e = d
            }
        }
        $("#coloursTooFew").toggleClass("hideMe", f <= this.numColours);
        if (e >= this.numColours) {
            var b = [];
            var a = 0;
            if (f < this.numColours) {
                a = 1
            }
            while (a < this.maxColours && this.colours[a].usage) {
                a++
            }
            for (var g = a; g < this.maxColours; g++) {
                if (this.colours[g].usage) {
                    if (this.colours[a]) {
                        b.push(this.colours[a])
                    }
                    this.colours[a++] = this.colours[g];
                    this.colours[g] = null
                }
            }
            for (var a = 0; a < this.maxColours; a++) {
                if (!this.colours[a]) {
                    this.colours[a] = b[0];
                    b.shift()
                }
            }
            var c = [];
            for (var d = 0; d < this.maxColours; d++) {
                c[this.colours[d].index] = d;
                this.colours[d].index = d;
                this.colours[d].slot = d
            }
            this.remapCb(c, false)
        }
        this.placeColours()
    },
    setFormValues: function() {
        var a = this.numColours;
        if (this.sizeField) {
            this.sizeField.setValue(a)
        }
        if (this.backgroundColourCheck) {
            this.backgroundColourCheck.prop("checked", this.hasBackgroundColour)
        }
    },
    placeColours: function() {
        if (!this.canvas) {
            return
        }
        var j = 1;
        var k = 0;
        for (var b = 1; b <= this.numColours; b++) {
            var q = this.calcBlobSize(this.canvas, b);
            if (q > k) {
                k = q;
                j = b
            }
        }
        this.calcBlobSize(this.canvas, j);
        var s = Math.floor(this.canvas.width / this.cols);
        var p = Math.floor(s / 2);
        var h = Math.floor(this.canvas.height / this.rows);
        var e = Math.floor(h / 2);
        this.slots = [];
        for (var f = 0; f < this.numColours; f++) {
            var n = (f % this.cols);
            var m = Math.floor(f / this.cols);
            var g = n * s + p;
            var c = m * h + e;
            this.colours[f].pos.x = g;
            this.colours[f].pos.y = c;
            var d = g - p;
            var l = c - e;
            var o = d + s;
            var a = l + h;
            this.slots[f] = new PaletteSlot(d, l, o, a, g, c, f, f)
        }
        this.slots[this.numColours - 1].right = this.canvas.width
    },
    fromString: function(h) {
        if (!h) {
            return
        }
        var f = 0;
        var d = B64Coder.decodeNumberU(h.slice(f, f + 2), 12);
        f += 2;
        var c = B64Coder.decodeNumberU(h.slice(f, f + 1), 6);
        f += 1;
        if (d >= 1) {
            this.numColours = B64Coder.decodeNumberU(h.slice(f, f + 2), 12);
            f += 2
        } else {
            this.numColours = B64Coder.decodeNumberU(h.slice(f, f + 1), 6);
            f += 1
        }
        if (!(this.minColours <= this.numColours && this.numColours <= this.maxColours)) {
            this.numColours = this.defaultNumColours
        }
        if (!(0 <= c && c < this.numColours)) {
            c = 0
        }
        var g = 64;
        if (d >= 1) {
            g = this.numColours
        }
        for (var a = 0; a < g; a++) {
            var e = this.colours[a];
            var j = colourSource.extractId(h.slice(f, f + 7));
            e.setId(j);
            f += 7
        }
        for (var a = 0; a < this.maxColours; a++) {
            this.colours[a].usage = 0
        }
        if (d >= 1) {
            this.setHasBackgroundColour(B64Coder.decodeNumberU(h.slice(f, f + 1), 6))
        }
        f += 1;
        this.checkUsedColours();
        this.currentIndex = c;
        if (this.setIndexCallback) {
            this.setIndexCallback(this.currentIndex)
        }
        this.draw();
        this.setFormValues()
    },
    toString: function() {
        var d = new Array(4 + this.numColours);
        var b = 0;
        var a = 1;
        d[b++] = B64Coder.encodeNumber(a, 12);
        d[b++] = B64Coder.encodeNumber(this.currentIndex, 6);
        d[b++] = B64Coder.encodeNumber(this.numColours, 12);
        for (var g = 0; g < this.numColours; g++) {
            var f = colourSource.formatId(this.colours[g].id);
            d[b++] = f
        }
        d[b++] = B64Coder.encodeNumber(this.hasBackgroundColour, 6);
        var e = d.join("");
        return e
    },
    calcBlobSize: function(a, b) {
        this.rows = b;
        this.cols = Math.ceil(this.numColours / this.rows);
        this.blobRadius = Math.floor(Math.min(a.width / this.cols, a.height / this.rows) / 2) - 3;
        return this.blobRadius
    },
    draw: function() {
        if (!this.canvas) {
            return
        }
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.lineWidth = 2;
        for (var a = 0; a < this.numColours; a++) {
            this.drawBlob(a)
        }
        if (this.currentIndex >= 0) {
            this.drawBlob(this.currentIndex)
        }
    },
    drawBlob: function(c) {
        if (!this.canvas) {
            return
        }
        var b = this.context;
        var a = this.colours[c];
        if (a.sprite) {
            b.drawImage(a.sprite, a.pos.x + a.spriteOffX, a.pos.y + a.spriteOffY);
            return
        }
        var d = 0;
        if (c == this.currentIndex) {
            d = this.blobRadius + 7.5;
            var g = b.createRadialGradient(a.pos.x, a.pos.y, this.blobRadius, a.pos.x, a.pos.y, d);
            g.addColorStop(0, a.usage ? "#000000" : "#888888");
            g.addColorStop(1, "rgba(255,255,255,0.0)");
            b.fillStyle = g;
            b.fillRect(a.pos.x - d, a.pos.y - d, 2 * d, 2 * d)
        } else {
            d = this.blobRadius + 5;
            b.clearRect(a.pos.x - d, a.pos.y - d, 2 * d, 2 * d)
        }
        b.strokeStyle = a.usage ? "#000000" : "#aaaaaa";
        b.fillStyle = a.colour;
        b.beginPath();
        b.arc(a.pos.x, a.pos.y, this.blobRadius, 0, 2 * Math.PI);
        b.closePath();
        b.fill();
        b.stroke();
        if (this.hasBackgroundColour && c == 0) {
            var e = d - 4;
            b.font = e + "px Arial";
            b.fillStyle = "#000000";
            b.fillText("bg", a.pos.x - e * 0.5 - 1, a.pos.y + d * 0.25)
        }
    },
    getMousePos: function(a) {
        var d = $(this.canvas).offset();
        var c = a.clientX - d.left + window.pageXOffset;
        var b = a.clientY - d.top + window.pageYOffset;
        return {
            x: c,
            y: b
        }
    },
    isPointInCanvas: function(a) {
        return a.x >= 0 && a.x < this.canvas.width && a.y >= 0 && a.y < this.canvas.height
    },
    startMouse: function() {
        if (!this.drag) {
            this.drag = new Draggable($(this.canvas), this)
        }
    },
    moveCapture: false,
    dragOver: function(a) {
        var c = this.getMousePos(a);
        if (c.x < 0 || this.canvas.width <= c.x || c.y < 0 || this.canvas.height <= c.y) {
            if (this.moveCapture) {
                this.moveCapture = false;
                MouseMoveCapture.end()
            }
            cdoToolTip.hide();
            return
        }
        if (!this.moveCapture) {
            if (MouseMoveCapture.active()) {
                return
            }
            this.moveCapture = true;
            MouseMoveCapture.start({
                self: this
            }, function(d) {
                cdoPalette.dragOver(d)
            })
        }
        var b = this.closest(c);
        if (b == -1) {
            cdoToolTip.hide()
        } else {
            cdoToolTip.show(a, this.colours[b].name)
        }
    },
    dragMove: function(a) {
        if (!this.dragging) {
            return
        }
        var f = this.getMousePos(a);
        this.dragging.pos.x = f.x - this.blobOffX;
        this.dragging.pos.y = f.y - this.blobOffY;
        var e = null;
        for (var c in this.slots) {
            var d = this.slots[c];
            if (d.hit(this.dragging.pos)) {
                e = d;
                break
            }
        }
        if (e) {
            this.dragging.deleteMe = false;
            if (this.dragging.slot != e.idx) {
                var b = this.dragging.slot < e.idx ? 1 : -1;
                this.shuffleSlots(this.dragging.slot, e.idx, b);
                e.content = this.dragging.index;
                this.dragging.slot = e.idx
            }
        } else {
            this.dragChange = true;
            this.dragging.deleteMe = true;
            e = this.slots[this.numColours - 1];
            this.shuffleSlots(this.dragging.slot, e.idx, 1);
            e.content = this.dragging.index;
            this.dragging.slot = e.idx
        }
        this.draw()
    },
    dragEnd: function(l) {
        if (!this.dragging) {
            return
        }
        this.stopAnimate();
        var k = [];
        var c = [];
        for (var e = 0; e < this.numColours; e++) {
            c[e] = this.colours[e];
            k[this.slots[e].content] = e
        }
        var g = this.dragging.index;
        for (var e = 0; e < this.numColours; e++) {
            this.colours[k[e]] = c[e];
            var a = this.colours[k[e]];
            var j = this.slots[k[e]];
            j.content = j.idx;
            a.index = k[e];
            a.pos.x = j.xPos;
            a.pos.y = j.yPos;
            a.sprite = null
        }
        var d = this.dragging.deleteMe;
        if (this.dragging.deleteMe) {
            var b = clone(this.dragging.cdoColour);
            this.dragging.setId(colourSource.idByColour("#ffffff"));
            var h = this.closestColourIndex(b);
            k[g] = h;
            var f = this.dragging.usage;
            this.dragging.usage = 0;
            this.colours[h].usage += f
        }
        this.dragging.dragged = false;
        this.dragging = null;
        if (this.dragChange) {
            this.lastAction = this.lastActionEnum.COLOUR_USED;
            this.currentIndex = k[this.currentIndex];
            if (this.setIndexCallback) {
                this.setIndexCallback(this.currentIndex)
            }
        }
        this.remapCb(k, d);
        this.checkUsedColours();
        this.draw();
        AutoSave.save()
    },
    shuffleSlots: function(b, d, c) {
        var h = 20;
        this.startAnimate();
        for (var e = b; e != d; e += c) {
            this.dragChange = true;
            var k = this.slots[e];
            k.content = this.slots[e + c].content;
            var a = this.colours[this.slots[e].content];
            a.slot = e;
            a.animSteps = [];
            if (k.yPos == a.pos.y) {
                var l = (k.xPos + a.pos.x) / 2;
                var j = (k.yPos + a.pos.y) / 2;
                this.animColour(a, l, j, a.pos.x, a.pos.y, h / 2, true);
                this.animColour(a, k.xPos, k.yPos, l, j, h / 2, false)
            } else {
                var g = k.xPos > a.pos.x ? 0 : this.canvas.width;
                this.animColour(a, g, a.pos.y, a.pos.x, a.pos.y, h / 2, true);
                var f = k.xPos > a.pos.x ? this.canvas.width : 0;
                this.animColour(a, k.xPos, k.yPos, f, k.yPos, h / 2, false)
            }
        }
    },
    animColour: function(a, q, o, g, f, l, b) {
        var h = l * (l + 1) / 2;
        var d = b ? 1 : l;
        var c = b ? 1 : -1;
        var r = (q - g) / h;
        var p = (o - f) / h;
        var n = g,
            k = f;
        for (var e = 0; e < l; e++) {
            n += r * d;
            k += p * d;
            d += c;
            a.animSteps.push({
                x: n,
                y: k
            })
        }
    },
    dragStart: function(a) {
        var c = this.getMousePos(a);
        this.moveCapture = false;
        this.dragChange = false;
        cdoToolTip.hide();
        var b = this.closest(c);
        if (b != -1) {
            this.setCurrentIndex(b);
            this.lastAction = this.lastActionEnum.CHANGE_INDEX;
            this.dragging = this.colours[b];
            this.dragging.dragged = true;
            this.dragging.deleteMe = false;
            this.currentIndex = -1;
            this.draw();
            this.getSprites();
            this.currentIndex = b;
            this.colours[b].sprite = null;
            this.drawBlob(b);
            this.getSprite(b)
        }
    },
    animTimer: null,
    startAnimate: function() {
        clearTimeout(this.animTimer);
        this.animTimer = setInterval(function() {
            cdoPalette.animStep()
        }, 16)
    },
    stopAnimate: function() {
        clearTimeout(this.animTimer);
        for (var a = 0; a < this.numColours; a++) {
            this.colours[a].animSteps = []
        }
    },
    animStep: function() {
        var d = false;
        for (var b = 0; b < this.numColours; b++) {
            if (b == this.currentIndex) {
                continue
            }
            var a = this.colours[b];
            if (a.animSteps.length > 0) {
                var c = a.animSteps[0];
                a.pos.x = c.x;
                a.pos.y = c.y;
                a.animSteps.shift();
                if (a.animSteps.length) {
                    d = true
                }
            } else {
                a.animSteps = 0;
                var e = this.slots[a.slot];
                a.pos.x = e.xPos;
                a.pos.y = e.yPos
            }
        }
        if (!d) {
            this.stopAnimate()
        }
        this.draw()
    },
    getSprites: function() {
        for (var a = 0; a < this.numColours; a++) {
            this.getSprite(a)
        }
    },
    getSprite: function(f) {
        var d = this.colours[f];
        var k = this.slots[f];
        var e = k.left;
        var a = k.right;
        var n = k.top;
        var j = k.bottom;
        if (f == this.currentIndex) {
            e = Math.max(e - 2, 0);
            n = Math.max(n - 2, 0);
            a = Math.min(a + 2, this.canvas.width);
            j = Math.min(j + 2, this.canvas.height)
        }
        var m = a - e;
        var g = j - n;
        var c = this.context.getImageData(e, n, m, g);
        d.sprite = document.createElement("canvas");
        d.sprite.width = m;
        d.sprite.height = g;
        d.sprite.getContext("2d").putImageData(c, 0, 0);
        d.spriteOffX = e - k.xPos;
        d.spriteOffY = n - k.yPos
    },
    closest: function(g) {
        if (!this.isPointInCanvas(g)) {
            return -1
        }
        var e = 0;
        var b = 1000000;
        for (var d = 0; d < this.numColours; d++) {
            var f = Math.abs(g.x - this.colours[d].pos.x) + Math.abs(g.y - this.colours[d].pos.y);
            if (f < b) {
                b = f;
                e = d
            }
        }
        var c = g.x - this.colours[e].pos.x;
        var a = g.y - this.colours[e].pos.y;
        if (c * c + a * a < this.blobRadius * this.blobRadius) {
            this.blobOffX = c;
            this.blobOffY = a;
            return e
        }
        return -1
    },
    setColourCallback: null,
    setIndexCallback: null,
    remapCb: null,
    linkTo: function(a, c, b) {
        this.setColourCallback = a;
        this.setIndexCallback = c;
        this.remapCb = b
    },
    findColourIdIndex: function(e) {
        var b = colourSource.colourById(e);
        var d = new CdoColour(b);
        var a = colourSource.threshold(e);
        for (var c = 0; c < this.numColours; c++) {
            if (d.dist(this.colours[c].cdoColour) <= a) {
                return c
            }
        }
        return -1
    },
    pickNewColourIdIndex: function(b) {
        var a = this.currentIndex;
        a = this.findColourIdIndex(b);
        return this.nextUnusedIndex(a)
    },
    nextUnusedIndex: function(c) {
        if (c == -1) {
            for (var b = 0; b < this.numColours; b++) {
                if (this.colours[b].colour == "#ffffff" && this.colours[b].usage == 0) {
                    c = b;
                    break
                }
            }
        }
        if (c == -1) {
            c = this.currentIndex;
            for (var b = 0; b < this.numColours; b++) {
                var a = (this.lastUnusedIndex + b + 1) % this.numColours;
                if (this.colours[a].usage == 0) {
                    c = a;
                    this.lastUnusedIndex = a;
                    break
                }
            }
        }
        return c
    },
    setCurrentIndex: function(a) {
        if (this.currentIndex != a) {
            this.currentIndex = a;
            if (this.setIndexCallback) {
                this.setIndexCallback(this.currentIndex)
            }
            AutoSave.save("quiet")
        }
    },
    setId: function(c) {
        var b = this.lastAction == this.lastActionEnum.COLOUR_USED ? this.pickNewColourIdIndex(c) : this.currentIndex;
        if (this.colours[b].id != c) {
            AutoSave.save()
        }
        this.colours[b].setId(c);
        var a = this.currentIndex != b;
        this.setCurrentIndex(b);
        if (a) {
            this.lastAction = this.lastActionEnum.CHANGE_INDEX;
            this.draw()
        } else {
            this.drawBlob(b)
        }
        if (colourSource.strongChoice()) {
            this.lastAction = this.lastActionEnum.COLOUR_USED
        }
        if (this.setColourCallback) {
            this.setColourCallback(colourSource.colourById(c))
        }
    },
    changeColourUsage: function(a, b) {
        if (a < 0 || a >= this.maxColours) {
            return
        }
        this.colours[a].usage += b;
        this.lastAction = this.lastActionEnum.COLOUR_USED;
        if (this.colours[a].usage == 0) {
            this.checkUsedColours()
        }
        if (this.colours[a].usage == b || this.colours[a].usage == 0) {
            this.draw()
        }
    },
    colour: function(a) {
        return this.colours[a] ? this.colours[a].colour : "#ffffff"
    },
    id: function(a) {
        return this.colours[a] ? this.colours[a].id : "#ffffff"
    },
    used: function(a) {
        return this.colours[a].usage > 0
    },
    closestColourIndex: function(d) {
        var a = 1000000;
        var f = 0;
        for (var c = 0; c < this.numColours; c++) {
            var b = this.colours[c].cdoColour;
            var e = d.dist(b);
            if (e < a) {
                a = e;
                f = c
            }
        }
        return f
    },
    selectClosestColour: function(b) {
        var c = this.closestColourIndex(b);
        var a = this.currentIndex;
        this.setCurrentIndex(c);
        this.drawBlob(a);
        this.drawBlob(this.currentIndex)
    },
    closestColourIndexMulti: function(e, b) {
        for (var c = 0; c < this.numColours; c++) {
            this.colours[c].votes = 0
        }
        for (var n in e) {
            var f = e[n];
            for (var c = 0; c < this.numColours; c++) {
                var a = this.colours[c].cdoColour;
                var h = f.dist(a);
                this.colours[c].votes += 1 / (3 + h)
            }
        }
        var m = 0;
        var g = 0;
        for (var c = 0; c < this.numColours; c++) {
            var l = this.colours[c].votes;
            if (l > m) {
                m = l;
                g = c
            }
        }
        if (b) {
            var d = this.closestColourIndex(b);
            var k = b.dist(this.colours[d].cdoColour);
            var j = pgMagicUtils.definition * e.length / (3 + k);
            if (j > m) {
                g = d
            }
        }
        return g
    },
    backgroundColourCheckChange: function() {
        this.sizeField.immediate();
        this.setHasBackgroundColour(this.backgroundColourCheck.prop("checked"));
        AutoSave.save("quiet");
        this.draw()
    },
    setHasBackgroundColour: function(a) {
        this.hasBackgroundColour = a
    },
    sizeFieldChanged: function(a) {
        this.setNumColours(a)
    }
};

function paletteInit() {
    var a = document.getElementById("paletteCanvas");
    cdoPalette.init(a)
}

function PaletteBlob(a, b, c) {
    this.index = a ? a : 0;
    this.usage = b ? b : 0;
    this.pos = c ? c : {
        x: 0,
        y: 0
    };
    this.setId = function(d) {
        this.id = d;
        this.colour = colourSource.colourById(d);
        this.name = colourSource.nameById(d);
        this.cdoColour = new CdoColour(this.colour)
    };
    this.setId("#ffffff");
    this.votes = 0;
    this.dragged = false;
    this.slot = a;
    this.sprite = null;
    this.dx = 0;
    this.dy = 0;
    this.animSteps = 0
}

function PaletteSlot(g, f, c, b, h, e, a, d) {
    this.left = g;
    this.top = f;
    this.right = c;
    this.bottom = b;
    this.xPos = h;
    this.yPos = e;
    this.idx = a;
    this.content = d;
    this.hit = function(j) {
        return this.left <= j.x && j.x <= this.right && this.top <= j.y && j.y <= this.bottom
    }
}
pgToolColourPicker = {
    activate: function(a) {
        designGrid.toolCtx.clearRect(0, 0, designGrid.toolCanvas.width, designGrid.toolCanvas.height);
        pgTracing.setSufficientAlpha()
    },
    deactivate: function(a) {},
    sampleTracing: function(a, p, l, j, e) {
        a = Math.round(a);
        p = Math.round(p);
        l = Math.round(l);
        j = Math.round(j);
        var d = 0,
            h = 0,
            n = 0,
            k = 0;
        for (var m = p; m <= j; m++) {
            for (var o = a; o <= l; o++) {
                if (o < 0 || o >= designGrid.ctxClipW || m < 0 || m >= designGrid.ctxClipH) {
                    continue
                }
                var f = (m * designGrid.imageCanvas.width + o) * 4;
                d += e.data[f];
                h += e.data[f + 1];
                n += e.data[f + 2];
                k += 1
            }
        }
        if (k == 0 || isNaN(n)) {
            return null
        }
        d = Math.round(d / k);
        h = Math.round(h / k);
        n = Math.round(n / k);
        return new CdoColour(d, h, n)
    },
    lastTrackedPos: null,
    mouseDown: function(c) {
        this.lastTrackedPos = c;
        var a = this.sampleTracing(c.x - 1, c.y - 1, c.x + 1, c.y + 1, pgTracing.imgData);
        if (!a) {
            return
        }
        if (cdoPalette.lastAction == cdoPalette.lastActionEnum.COLOUR_USED) {
            cdoPalette.setCurrentIndex(cdoPalette.nextUnusedIndex(-1))
        }
        var b = a.toString();
        colourSource.setColour(b);
        cdoPalette.draw();
        cdoPalette.lastAction = cdoPalette.lastActionEnum.COLOUR_USED
    },
    mouseMove: function(c) {
        if (!this.lastTrackedPos) {
            return
        }
        var b = this.lastTrackedPos.x - c.x;
        var a = this.lastTrackedPos.y - c.y;
        if (b * b + a * a < 25) {
            return
        }
        this.mouseDown(c)
    },
};
var designGrid = {
    gridCanvas: null,
    gridCtx: null,
    toolCanvas: null,
    toolCtx: null,
    imageCanvas: null,
    imageCtx: null,
    tracingCanvas: null,
    tracingCtx: null,
    grid: null,
    colour: "#ff0000",
    bgIndex: 0,
    gridLineColour: "#c0c0a0",
    paletteIndex: 0,
    widthField: null,
    heightField: null,
    deselSize: 6,
    deselWidth: 6,
    deselRatio: 1,
    deselDrawWidth: 6,
    deselDrawHeight: 6,
    minDeselSize: 6,
    maxDeselSize: 6,
    minGridDeselSize: 6,
    naturalDeselSize: 6,
    naturalDeselWidth: 6,
    offXBase: 0,
    offXAlt: 0,
    offXExtra: 0,
    offY: 0,
    clip: {
        t: 0,
        l: 0,
        b: 0,
        r: 0
    },
    ctxClipW: 599,
    ctxClipH: 599,
    gridLinesCheck: null,
    showGridEnabled: true,
    offsetRowsCheck: null,
    offsetRows: false,
    BS_LEFT: 1,
    BS_TOP: 2,
    BS_FORWARD: 4,
    BS_BACK: 8,
    init: function() {
      alert('canvas')
        DesIO.register("DG", function(a, b) {
            designGrid.fromString(a, b)
        }, function() {
            return designGrid.toString()
        });
        this.gridCanvas = document.getElementById("designGridCanvas");
        this.gridCtx = this.gridCanvas.getContext("2d");
        this.toolCanvas = document.getElementById("designGridToolCanvas");
        this.toolCtx = this.toolCanvas.getContext("2d");
        this.imageCanvas = document.getElementById("designGridImageCanvas");
        this.imageCtx = this.imageCanvas.getContext("2d");
        this.tracingCanvas = document.getElementById("designGridTracingCanvas");
        this.tracingCtx = this.tracingCanvas.getContext("2d");
        this.widthField = new NumberField("#designGridWidth", function(a) {
            designGrid.setWidth(a)
        }, 800);
        this.heightField = new NumberField("#designGridHeight", function(a) {
            designGrid.setHeight(a)
        }, 800);
        this.showGridEnabled = userSettings.get("showGridEnabled", true);
        this.gridLinesCheck = $("#designGridShowLines");
        this.gridLinesCheck.prop("checked", this.showGridEnabled);
        this.gridLinesCheck.change(function() {
            designGrid.gridLinesCheckChange()
        });
        this.offsetRowsCheck = $("#designGridOffsetRows");
        this.offsetRowsCheck.prop("checked", this.offsetRows);
        this.offsetRowsCheck.change(function() {
            designGrid.offsetRowsCheckChange()
        });
        this.setOffsetRows(false);
        this.startMouse();
        this.reset()
    },
    reset: function(a) {
        cdoPalette.setId(colourSource.idByColour("#ffffd7"));
        this.bgIndex = 0;
        this.grid = new DeselGrid(this.width(), this.height(), this.bgIndex);
        cdoPalette.changeColourUsage(this.bgIndex, this.grid.width * this.grid.height);
        this.resetZoom(a)
    },
    resetZoom: function(a) {
        this.offXBase = 0;
        this.offY = 0;
        this.calcDeselGeom(a);
        this.setClips();
        pgTracing.draw();
        this.draw()
    },
    offsetX: function(a) {
        if (!this.offsetRows || (a & 1) == 0) {
            return this.offXBase
        } else {
            return this.offXAlt
        }
    },
    width: function() {
        var a = Number(this.widthField.value());
        if (!a) {
            if (this.grid) {
                a = this.grid.width
            } else {
                a = 50
            }
        }
        return a
    },
    height: function() {
        var a = Number(this.heightField.value());
        if (!a) {
            if (this.grid) {
                a = this.grid.height
            } else {
                a = 50
            }
        }
        return a
    },
    setWidth: function(a) {
        if (a == this.grid.width) {
            return
        }
        this.grid.setWidth(a, this.bgIndex);
        this.resetZoom();
        AutoSave.save()
    },
    setHeight: function(a) {
        if (a == this.grid.height) {
            return
        }
        this.grid.setHeight(a, this.bgIndex);
        this.resetZoom();
        AutoSave.save()
    },
    setClips: function() {
        this.clipCtx("tracing");
        this.clipCtx("grid");
        this.clipCtx("tool");
        this.clipCtx("image");
        this.clip = this.gridClip();
        pgTracing.applyAlpha()
    },
    clipCtx: function(d) {
        var c = this[d + "Canvas"];
        c.width++;
        c.width--;
        var b = this[d + "Ctx"];
        b.beginPath();
        var a = this.grid.width * this.deselWidth;
        if (this.offsetRows) {
            a += Math.floor(this.deselWidth / 2)
        }
        var e = this.grid.height * this.deselSize;
        if (this.showGrid()) {
            a--;
            e--
        }
        a = Math.min(a, c.width);
        e = Math.min(e, c.height);
        this.ctxClipW = a;
        this.ctxClipH = e;
        b.rect(0, 0, a, e);
        b.clip()
    },
    toString: function() {
        var a = 3;
        var b = 1;
        while ((1 << b) < cdoPalette.numColours) {
            b++
        }
        var c = B64Coder.encodeNumber(a, 12) + colourSource.formatId("#ffffff") + B64Coder.encodeNumber(this.bgIndex, 6) + B64Coder.encodeNumber(Math.round(this.deselRatio * 1000), 24) + B64Coder.encodeNumber(this.offsetRows, 6) + B64Coder.encodeNumber(b, 6) + this.grid.toString(b);
        return c
    },
    fromString: function(f, h) {
        if (!f) {
            return
        }
        var a = 0;
        var d = B64Coder.decodeNumberU(f.slice(a, a + 2), 12);
        a += 2;
        colourSource.extractId(f.slice(a, a + 7));
        a += 7;
        this.bgIndex = B64Coder.decodeNumberU(f.slice(a, a + 1), 6);
        a += 1;
        var c = this.offsetRows;
        var g = this.deselRatio;
        if (d >= 1) {
            this.deselRatio = B64Coder.decodeNumberU(f.slice(a, a + 4), 24) / 1000;
            a += 4;
            this.setOffsetRows(B64Coder.decodeNumberU(f.slice(a, a + 1), 6));
            a += 1
        } else {
            this.deselRatio = 1;
            this.setOffsetRows(false)
        }
        var k = this.grid.width,
            e = this.grid.height;
        var b = 6;
        if (d >= 3) {
            b = B64Coder.decodeNumberU(f.slice(a, a + 1), 6);
            a += 1
        }
        var j = this.grid.fromString(f.slice(a), d, b);
        this.setGridPopupVals();
        if (h || this.grid.width != k || this.grid.height != e || c != this.offsetRows || g != this.deselRatio) {
            this.calcDeselGeom()
        } else {
            this.resizeGridClip(j)
        }
        this.setClips();
        this.populatePaletteIndices();
        this.draw()
    },
    resizeGridClip: function(b) {
        var c = false;
        if (b.l < this.clip.l) {
            this.clip.l = b.l;
            c = true
        }
        if (b.t < this.clip.t) {
            this.clip.t = b.t;
            c = true
        }
        if (b.r > this.clip.r) {
            this.clip.r = b.r;
            c = true
        }
        if (b.b > this.clip.b) {
            this.clip.b = b.b;
            c = true
        }
        if (c) {
            var a = Math.max(this.deselRatio * (1 + this.clip.r - this.clip.l) + this.offXExtra / this.deselWidth, 1 + this.clip.b - this.clip.t);
            this.deselSize = Math.floor(this.gridCanvas.width / a);
            this.calcDeselWidth();
            this.offXBase = -this.deselWidth * this.clip.l;
            this.calcOffXAlt();
            this.offY = -this.deselSize * this.clip.t;
            this.deselSizeUpdated()
        }
    },
    calcDeselWidth: function() {
        this.deselWidth = this.applyDeselRatio(this.deselSize);
        this.deselWidth = Math.max(this.deselWidth, 1);
        this.calcOffXAlt();
        this.checkBackstitchTool()
    },
    calcOffXAlt: function() {
        this.offXExtra = this.offsetRows ? Math.round(this.deselWidth / 2) : 0;
        this.offXAlt = this.offXBase + this.offXExtra
    },
    applyDeselRatio: function(b) {
        var a = b * this.deselRatio;
        if (this.deselRatio >= 1) {
            a = Math.floor(a)
        } else {
            a = Math.ceil(a)
        }
        return a
    },
    populatePalette: function() {
        for (var c = 0; c < this.grid.height; c++) {
            for (var a = 0; a < this.grid.height; a++) {
                var b = this.colourIdAt(a, c);
                cdoPalette.setId(b);
                cdoPalette.changeColourUsage(cdoPalette.findColourIdIndex(b), 1)
            }
        }
    },
    populatePaletteIndices: function() {
        for (var b = 0; b < this.grid.height; b++) {
            for (var a = 0; a < this.grid.width; a++) {
                cdoPalette.changeColourUsage(this.indexAt(a, b), 1)
            }
        }
    },
    indexAt: function(a, c) {
        var b = this.grid.index(a, c);
        if (!b) {
            b = this.bgIndex
        }
        return b
    },
    colourIdAt: function(a, b) {
        return cdoPalette.id(this.indexAt(a, b))
    },
    colourAt: function(a, b) {
        return cdoPalette.colour(this.indexAt(a, b))
    },
    setColour: function(b) {
        var a = (this.colour != b);
        this.colour = b;
        if (a && cdoPalette.used(this.paletteIndex)) {
            this.draw()
        }
    },
    setPaletteIndex: function(a) {
        this.paletteIndex = a;
        this.colour = cdoPalette.colour(a)
    },
    remapColours: function(b, d) {
        for (var c = 0; c < this.grid.height; c++) {
            for (var a = 0; a < this.grid.width; a++) {
                this.grid.setIndex(a, c, b[this.grid.index(a, c)])
            }
        }
        AutoSave.save("quiet");
        if (d) {
            this.draw()
        }
    },
    calcDeselGeom: function(a) {
        var e = this.naturalDeselSize;
        var d = this.naturalDeselWidth;
        var b = this.grid.width;
        if (this.offsetRows) {
            b += 0.5
        }
        b *= this.deselRatio;
        this.deselSize = Math.min(Math.floor(this.gridCanvas.width / b), Math.floor(this.gridCanvas.height / this.grid.height));
        var c = this.offsetRows ? 2 : 1;
        this.minDeselSize = Math.max(this.deselSize, 1);
        this.naturalDeselSize = Math.max(this.minDeselSize, Math.ceil(c / this.deselRatio));
        this.naturalDeselWidth = Math.round(this.naturalDeselSize * this.deselRatio);
        this.deselSize = a ? this.minDeselSize : this.naturalDeselSize;
        this.calcDeselWidth();
        this.maxDeselSize = Math.max(Math.floor(this.gridCanvas.width / 5), Math.floor(this.gridCanvas.height / 5));
        if (this.deselRatio < 1) {
            this.maxDeselSize /= this.deselRatio
        }
        this.deselSizeUpdated(this.naturalDeselWidth / d, this.naturalDeselSize / e)
    },
    deselSizeUpdated: function(a, b) {
        this.limitOffset();
        this.updateZoomButtons();
        this.calcDeselDrawSize();
        pgTracing.deselNaturalSizeChanged(a, b)
    },
    updateZoomButtons: function() {
        toolBox.setEnabled("toolZoomIn", this.deselSize < this.maxDeselSize);
        toolBox.setEnabled("toolZoomOut", this.deselSize > this.minDeselSize)
    },
    calcDeselDrawSize: function() {
        this.deselDrawHeight = this.deselSize;
        this.deselDrawWidth = this.deselWidth;
        if (this.showGrid()) {
            this.deselDrawWidth--;
            this.deselDrawHeight--
        }
    },
    zoomObserverCB: null,
    zoomChange: function(d, c) {
        this.updateZoomButtons();
        this.calcDeselDrawSize();
        var a = this.deselSize / d;
        var b = this.deselWidth / c;
        var f = ((this.gridCanvas.width / 2) - this.offXBase) * b;
        var e = ((this.gridCanvas.height / 2) - this.offY) * a;
        this.offXBase = (this.gridCanvas.width / 2) - f;
        this.calcOffXAlt();
        this.offY = (this.gridCanvas.width / 2) - e;
        this.limitOffset();
        this.setClips();
        pgTracing.draw();
        this.draw();
        if (toolBox.currentTool.zoomChanged) {
            toolBox.currentTool.zoomChanged()
        }
        if (this.zoomObserverCB) {
            this.zoomObserverCB()
        }
    },
    limitOffset: function() {
        this.offXBase = Math.round(this.offXBase);
        this.offY = Math.round(this.offY);
        if (this.offXBase + this.grid.width * this.deselWidth + this.offXExtra < this.gridCanvas.width) {
            this.offXBase = this.gridCanvas.width - this.grid.width * this.deselWidth - this.offXExtra
        }
        if (this.offY + this.grid.height * this.deselSize < this.gridCanvas.height) {
            this.offY = this.gridCanvas.height - this.grid.height * this.deselSize
        }
        if (this.offXBase > 0) {
            this.offXBase = 0
        }
        if (this.offY > 0) {
            this.offY = 0
        }
        this.calcOffXAlt()
    },
    offsetChanged: function(d, c) {
        this.calcOffXAlt();
        var a = this.gridCtx.getImageData(0, 0, this.gridCanvas.width, this.gridCanvas.height);
        this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
        var e = this.clip;
        this.clip = this.gridClip();
        var b = $.extend({}, this.clip);
        this.gridCtx.putImageData(a, this.offXBase - d, this.offY - c);
        if (this.offXBase > d) {
            this.clip.r = Math.min(e.l + 1, this.grid.width - 1);
            this.drawDesels(this.gridCtx);
            this.clip.r = b.r
        } else {
            if (this.offXBase < d) {
                this.clip.l = Math.max(e.r - 1, 0);
                this.drawDesels(this.gridCtx);
                this.clip.l = b.l
            }
        }
        if (this.offY > c) {
            this.clip.b = Math.min(e.t + 1, this.grid.height - 1);
            this.drawDesels(this.gridCtx);
            this.clip.b = b.b
        } else {
            if (this.offY < c) {
                this.clip.t = Math.max(e.b - 1, 0);
                this.drawDesels(this.gridCtx);
                this.clip.t = b.t
            }
        }
        pgTracing.draw();
        this.drawGrid(this.gridCtx);
        if (toolBox.currentTool.offsetChanged) {
            toolBox.currentTool.offsetChanged()
        }
    },
    drawGridDesel: function(b, a, c) {
        b.fillStyle = this.colourAt(a, c);
        this.drawDeselRect(b, a, c);
        this.drawDeselBackstitch(b, a, c)
    },
    drawColouredDesel: function(c, a, d, b) {
        c.fillStyle = b;
        this.drawDeselRect(c, a, d);
        this.drawDeselBackstitch(c, a, d)
    },
    drawFixedDesel: function(b, a, c) {
        this.drawDeselRect(b, a, c);
        this.drawDeselBackstitch(b, a, c)
    },
    drawDeselRect: function(b, a, c) {
        b.fillRect(this.offsetX(c) + a * this.deselWidth, this.offY + c * this.deselSize, this.deselDrawWidth, this.deselDrawHeight)
    },
    drawDeselBackstitch: function(b, a, c) {
        this.drawBackstitch(b, a, c);
        this.drawBackstitch(b, a + 1, c);
        this.drawBackstitch(b, a, c + 1)
    },
    drawDesels: function(d) {
        for (var g = this.clip.t; g <= this.clip.b; g++) {
            var e = this.clip.l;
            var b = this.indexAt(e, g);
            var c = this.offsetX(g);
            for (var a = this.clip.l + 1; a <= this.clip.r; a++) {
                var f = this.indexAt(a, g);
                if (f != b) {
                    d.fillStyle = cdoPalette.colour(b);
                    d.fillRect(c + e * this.deselWidth, this.offY + g * this.deselSize, (a - e) * this.deselWidth, this.deselDrawHeight);
                    e = a;
                    b = f
                }
            }
            d.fillStyle = cdoPalette.colour(b);
            d.fillRect(c + e * this.deselWidth, this.offY + g * this.deselSize, (this.clip.r - e) * this.deselWidth + this.deselDrawWidth, this.deselDrawHeight)
        }
    },
    draw: function() {
        this.gridCtx.fillStyle = "#fff";
        this.gridCtx.fillRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
        this.drawDesels(this.gridCtx);
        this.drawGrid(this.gridCtx)
    },
    drawGrid: function(c) {
        if (this.showGrid()) {
            c.strokeStyle = this.gridLineColour;
            c.lineWidth = 1;
            for (var d = this.clip.t + 1; d <= this.clip.b; d++) {
                c.beginPath();
                c.moveTo(this.offXBase, this.offY + d * this.deselSize - 0.5);
                c.lineTo(this.offXAlt + this.grid.width * this.deselWidth - 1, this.offY + d * this.deselSize - 0.5);
                c.stroke()
            }
            if (this.offsetRows) {
                for (var d = this.clip.t; d <= this.clip.b; d++) {
                    var b = Math.round(this.offsetX(d));
                    for (var a = this.clip.l + 1; a <= this.clip.r; a++) {
                        c.beginPath();
                        c.moveTo(b + a * this.deselWidth - 0.5, this.offY + d * this.deselSize);
                        c.lineTo(b + a * this.deselWidth - 0.5, this.offY + (d + 1) * this.deselSize - 1);
                        c.stroke()
                    }
                }
            } else {
                for (var a = this.clip.l + 1; a <= this.clip.r; a++) {
                    c.beginPath();
                    c.moveTo(this.offXBase + a * this.deselWidth - 0.5, this.offY);
                    c.lineTo(this.offXBase + a * this.deselWidth - 0.5, this.offY + this.grid.height * this.deselSize - 1);
                    c.stroke()
                }
            }
        }
        this.drawBackstitches(c)
    },
    bsSize: 0.25,
    showBackstitch: function() {
        return !this.offsetRows && this.bsSize * this.deselWidth >= 1 && this.bsSize * this.deselSize >= 1
    },
    drawBackstitches: function(c) {
        if (!this.showBackstitch()) {
            return
        }
        this.setupBackstitchContext(c);
        for (var d = this.clip.t; d <= this.clip.b; d++) {
            for (var a = this.clip.l; a <= this.clip.r; a++) {
                var b = this.grid.backstitch(a, d);
                if (!b) {
                    continue
                }
                this.drawBackstitchLines(c, a, d, b)
            }
        }
    },
    drawBackstitch: function(c, a, d) {
        if (!this.isGridValid(a, d)) {
            return
        }
        if (!this.showBackstitch()) {
            return
        }
        var b = this.grid.backstitch(a, d);
        if (!b) {
            return
        }
        this.setupBackstitchContext(c);
        this.drawBackstitchLines(c, a, d, b)
    },
    setupBackstitchContext: function(a) {
        a.strokeStyle = "#000000";
        a.lineWidth = Math.min(this.bsSize * this.deselWidth, this.bsSize * this.deselSize)
    },
    drawBackstitchLines: function(g, c, j, e) {
        g.beginPath();
        var d = this.offXBase + c * this.deselWidth - 0.5;
        var h = d + this.deselWidth;
        var f = this.offY + j * this.deselSize - 0.5;
        var a = f + this.deselSize;
        if (e & this.BS_LEFT) {
            g.moveTo(d, f);
            g.lineTo(d, a)
        }
        if (e & this.BS_TOP) {
            g.moveTo(d, f);
            g.lineTo(h, f)
        }
        if (e & this.BS_FORWARD) {
            g.moveTo(d, a);
            g.lineTo(h, f)
        }
        if (e & this.BS_BACK) {
            g.moveTo(d, f);
            g.lineTo(h, a)
        }
        g.stroke()
    },
    clearToolCtx: function() {
        designGrid.toolCtx.clearRect(0, 0, designGrid.toolCanvas.width, designGrid.toolCanvas.height)
    },
    gridPossTouch: function(e, c) {
        if (this.offsetRows) {
            var f = e.x - c.x;
            var g = Math.abs(f);
            var d = Math.abs(e.y - c.y);
            if (g > 1 || d > 1) {
                return false
            }
            if (g == 0 || d == 0) {
                return true
            }
            if (e.y & 1) {
                return f == -1
            } else {
                return f == 1
            }
        } else {
            var f = Math.abs(e.x - c.x);
            var d = Math.abs(e.y - c.y);
            return f <= 1 && d <= 1
        }
    },
    gridLinesCheckChange: function() {
        var a = this.gridLinesCheck.prop("checked");
        this.showGridEnabled = a;
        userSettings.set("showGridEnabled", a);
        this.calcDeselDrawSize();
        this.setClips();
        pgTracing.draw();
        this.draw()
    },
    offsetRowsCheckChange: function() {
        var a = this.offsetRowsCheck.prop("checked");
        if (this.offsetRows == a) {
            return
        }
        this.setOffsetRows(a);
        this.calcDeselGeom();
        this.setClips();
        pgTracing.draw();
        this.draw();
        AutoSave.save("quiet")
    },
    setOffsetRows: function(a) {
        this.offsetRows = !!a;
        this.checkBackstitchTool()
    },
    checkBackstitchTool: function() {
        toolBox.setEnabled("toolBackstitch", this.showBackstitch())
    },
    showGrid: function() {
        return this.deselSize >= this.minGridDeselSize && this.deselWidth >= this.minGridDeselSize && this.showGridEnabled
    },
    gridClip: function() {
        var a = this.toGridPos({
            x: 0,
            y: 0
        });
        var b = this.toGridPos({
            x: this.gridCanvas.width - 1,
            y: this.gridCanvas.height - 1
        });
        if (this.offsetRows) {
            var d = this.toGridPos({
                x: 0,
                y: this.deselSize
            });
            a.x = Math.max(0, Math.min(a.x, d.x));
            var c = this.toGridPos({
                x: this.gridCanvas.width - 1,
                y: this.gridCanvas.height - 1 - this.deselSize
            });
            b.x = Math.max(b.x, c.x)
        }
        b.x = Math.min(b.x, this.grid.width - 1);
        b.y = Math.min(b.y, this.grid.height - 1);
        return {
            t: a.y,
            l: a.x,
            b: b.y,
            r: b.x
        }
    },
    getMousePos: function(a) {
        a.preventDefault();
        var d = $(this.toolCanvas).offset();
        var c = a.clientX - d.left + window.pageXOffset;
        var b = a.clientY - d.top + window.pageYOffset;
        return {
            x: c,
            y: b
        }
    },
    lastTouchX: 0,
    lastTouchY: 0,
    getTouchPos: function(a, g) {
        var f = $(this.toolCanvas).offset();
        var d = this.lastTouchX;
        var b = this.lastTouchY;
        var e = false;
        if (a.touches) {
            for (var c in a.touches) {
                var h = Number(c);
                if (!isNaN(h) && h != 0) {
                    e = true
                }
            }
            if (!e && g) {
                a.preventDefault()
            }
            if (a.touches.length == 1 && a.touches[0]) {
                d = a.touches[0].clientX - f.left + window.pageXOffset;
                b = a.touches[0].clientY - f.top + window.pageYOffset;
                this.lastTouchX = d;
                this.lastTouchY = b
            }
        }
        return {
            x: d,
            y: b,
            multi: e,
        }
    },
    isPointInCanvas: function(a) {
        return a.x >= 0 && a.x < this.gridCanvas.width && a.y >= 0 && a.y < this.gridCanvas.height
    },
    isPointInGrid: function(b) {
        if (!this.isPointInCanvas(b)) {
            return false
        }
        var a = this.toGridPos(b);
        return this.isGridValid(a.x, a.y)
    },
    startMouse: function() {
        var c = [this.toolCanvas, this.imageCanvas];
        for (var b = 0; b < 2; b++) {
            var a = c[b];
            a.addEventListener("mousedown", function(e) {
                var d = designGrid.getMousePos(e);
                if (!designGrid.touchActive) {
                    designGrid.mouseDown(d, e)
                }
            }, false);
            a.addEventListener("mousemove", function(e) {
                if (!designGrid.isMouseDown && !designGrid.touchActive) {
                    var d = designGrid.getMousePos(e);
                    designGrid.mouseMove(d, e)
                }
            }, false);
            a.addEventListener("touchstart", function(e) {
                var d = designGrid.getTouchPos(e, false);
                designGrid.touchActive = true;
                designGrid.mouseDown(d, e)
            }, false);
            a.addEventListener("touchend", function(d) {
                d.preventDefault()
            }, false);
            a.addEventListener("touchmove", function(d) {
                designGrid.getTouchPos(d, true)
            }, false)
        }
    },
    isMouseDown: false,
    touchActive: false,
    currentTool: this.toolPen,
    mouseDown: function(b, a) {
        if (!this.isPointInGrid(b)) {
            return
        }
        MouseUpCapture.start(function(d) {
            var c = designGrid.getMousePos(d.originalEvent);
            designGrid.mouseUp(c, d.originalEvent)
        });
        MouseMoveCapture.start(function(d) {
            var c = designGrid.getMousePos(d.originalEvent);
            if (!designGrid.touchActive) {
                designGrid.mouseMove(c, d.originalEvent)
            }
        });
        TouchEndCapture.start(function(d) {
            var c = designGrid.getTouchPos(d.originalEvent);
            designGrid.mouseUp(c, d.originalEvent)
        });
        TouchCancelCapture.start(function(d) {
            var c = designGrid.getTouchPos(d.originalEvent, false);
            designGrid.mouseUp(c, d.originalEvent)
        });
        TouchMoveCapture.start(function(d) {
            var c = designGrid.getTouchPos(d.originalEvent, true);
            designGrid.mouseMove(c, d.originalEvent)
        });
        if (b.multi) {
            return
        }
        this.isMouseDown = true;
        if (toolBox.currentTool.mouseDown) {
            toolBox.currentTool.mouseDown(b, a)
        }
    },
    mouseUp: function(b, a) {
        MouseUpCapture.end();
        MouseMoveCapture.end();
        TouchEndCapture.end();
        TouchMoveCapture.end();
        TouchCancelCapture.end();
        if (b.multi) {
            return
        }
        if (this.isMouseDown && toolBox.currentTool.mouseUp) {
            toolBox.currentTool.mouseUp(b, a)
        }
        this.isMouseDown = false
    },
    mouseMove: function(b, a) {
        if (b.multi) {
            return
        }
        if (this.isMouseDown || toolBox.currentTool.moveEventsWhileUp) {
            if (toolBox.currentTool.mouseMove) {
                toolBox.currentTool.mouseMove(b, a)
            }
        }
    },
    mouseMoveNonCaptured: function(b, a) {
        if (!this.isMouseDown) {
            this.mouseMove(b, a)
        }
    },
    toGridPos: function(d) {
        var c = Math.floor((d.y - this.offY) / this.deselSize);
        var b = this.offsetX(c);
        var a = Math.floor((d.x - b) / this.deselWidth);
        return {
            x: a,
            y: c
        }
    },
    toCanvasPos: function(d) {
        var b = this.offsetX(d.y);
        var a = b + d.x * this.deselWidth;
        var c = this.offY + d.y * this.deselSize;
        return {
            x: a,
            y: c
        }
    },
    toCanvasCentre: function(b) {
        var a = this.toCanvasPos(b);
        a.x += this.deselWidth / 2;
        a.y += this.deselSize / 2;
        return a
    },
    colourMousePos: function(b) {
        var a = this.toGridPos(b);
        this.colourGridPos(a)
    },
    isGridValid: function(a, b) {
        return this.grid.isValid(a, b)
    },
    isClipValid: function(a, b) {
        return this.clip.l <= a && a <= this.clip.r && this.clip.t <= b && b <= this.clip.b
    },
    limitToGrid: function(a) {
        if (a.x < 0) {
            a.x = 0
        }
        if (a.x >= this.grid.width) {
            a.x = this.grid.width - 1
        }
        if (a.y < 0) {
            a.y = 0
        }
        if (a.y >= this.grid.height) {
            a.y = this.grid.height - 1
        }
        return a
    },
    colourGridPos: function(a) {
        this.colourGridCoords(a.x, a.y)
    },
    colourGridCoords: function(a, c) {
        if (!this.isClipValid(a, c)) {
            return
        }
        var b = this.indexAt(a, c);
        if (b != this.paletteIndex) {
            cdoPalette.changeColourUsage(b, -1);
            this.grid.setIndex(a, c, this.paletteIndex);
            cdoPalette.changeColourUsage(this.paletteIndex, 1);
            this.drawGridDesel(this.gridCtx, a, c);
            AutoSave.save()
        }
    },
    batchColoured: 0,
    startBatchColour: function() {
        this.batchColoured = 0;
        this.gridCtx.fillStyle = this.colour
    },
    batchColourCoords: function(a, c) {
        var b = this.indexAt(a, c);
        if (b != this.paletteIndex) {
            cdoPalette.changeColourUsage(b, -1);
            this.grid.setIndex(a, c, this.paletteIndex);
            this.batchColoured++;
            this.drawFixedDesel(this.gridCtx, a, c)
        }
    },
    endBatchColour: function() {
        cdoPalette.changeColourUsage(this.paletteIndex, this.batchColoured);
        AutoSave.save()
    },
    copyToGrid: function(e, g, z, u, s, f, v, a, D, b, p) {
        if (p == undefined) {
            p = cdoPalette.hasBackgroundColour
        }
        var d = false;
        var C = 0,
            c = 0;
        if (b == pgToolSelect.BELOW_LEFT && !(v & 1)) {
            C = 0;
            c = -1
        } else {
            if (b == pgToolSelect.BELOW_RIGHT && (v & 1)) {
                C = 1;
                c = 0
            }
        }
        var o = 48;
        for (var h = 0; h < e.height; h++) {
            var n = a[h + D];
            var m = 1 + n.max - n.min;
            var q = z + h;
            var A = v + h;
            for (var k = 0; k < m; k++) {
                var r = g + k;
                var B = f + k + ((A & 1) ? c : C);
                if (e.isValid(r, q) && this.isClipValid(B, A)) {
                    var j = clone(e.grid.at(r, q));
                    var t = this.indexAt(B, A);
                    if (j.i == this.bgIndex && p) {
                        j.i = t
                    }
                    cdoPalette.changeColourUsage(t, -1);
                    var l = (j.b & o) >> 4;
                    j.b &= ~o;
                    this.grid.grid.setAt(B, A, j);
                    cdoPalette.changeColourUsage(j.i, 1);
                    this.drawGridDesel(this.gridCtx, B, A);
                    if (!this.offsetRows) {
                        if (k == m - 1 && this.isClipValid(B + 1, A)) {
                            this.grid.setBackstitch(B + 1, A, this.BS_LEFT, l & this.BS_LEFT);
                            this.drawGridDesel(this.gridCtx, B + 1, A)
                        }
                        if (h == e.height - 1 && this.isClipValid(B, A + 1)) {
                            this.grid.setBackstitch(B, A + 1, this.BS_TOP, l & this.BS_TOP);
                            this.drawGridDesel(this.gridCtx, B, A + 1)
                        }
                    }
                    d = true
                }
            }
        }
        if (d) {
            AutoSave.save()
        }
    },
    scrollBy: function(c, a) {
        var d = this.offXBase;
        var b = this.offY;
        this.offXBase += c;
        this.calcOffXAlt();
        this.offY += a;
        this.limitOffset();
        if (d != this.offXBase || b != this.offY) {
            this.offsetChanged(d, b)
        }
        return {
            dx: this.offXBase - d,
            dy: this.offY - b
        }
    },
    zoomIn: function() {
        var c = this.deselSize;
        var b = this.deselWidth;
        var d = this.deselSize * 1.25;
        var a = this.deselWidth * 1.25;
        var e = false;
        while (this.deselSize < this.maxDeselSize) {
            e = true;
            this.deselSize++;
            this.calcDeselWidth();
            if (this.deselSize >= d && this.deselWidth >= a) {
                break
            }
        }
        if (e) {
            this.zoomChange(c, b)
        }
        if (this.grid.width * this.deselWidth > this.gridCanvas.width || this.grid.height * this.deselSize > this.gridCanvas.height) {
            toolBox.selectTool("toolScroll")
        }
    },
    zoomOut: function() {
        var c = this.deselSize;
        var b = this.deselWidth;
        var d = this.deselSize * 0.8;
        var a = this.deselWidth * 0.8;
        var e = false;
        while (this.deselSize > this.minDeselSize) {
            e = true;
            this.deselSize--;
            this.calcDeselWidth();
            if (this.deselSize <= d && this.deselWidth <= a) {
                break
            }
        }
        if (e) {
            this.zoomChange(c, b)
        }
    },
    snapshot: function() {
        this.resetZoom();
        var a = this.gridCanvas.toDataURL();
        return a
    },
    gridPopupShown: function() {
        if (!this.cellShapeSlider) {
            this.cellShapeSlider = new CellShapeSlider("gridCellShapeThumb", "gridCellCanvas", function(a) {
                designGrid.setDeselRatio(a)
            })
        }
        this.setGridPopupVals()
    },
    setGridPopupVals: function() {
        if (this.cellShapeSlider) {
            this.cellShapeSlider.setRatio(this.deselRatio)
        }
        this.offsetRowsCheck.prop("checked", this.offsetRows);
        this.widthField.setValue(this.grid.width);
        this.heightField.setValue(this.grid.height)
    },
    setDeselRatio: function(a) {
        this.deselRatio = a;
        this.calcDeselGeom();
        this.setClips();
        pgTracing.draw();
        this.draw();
        AutoSave.save()
    },
    addBackstitch: function(a, c, b) {
        if (!this.isGridValid(a, c)) {
            return
        }
        this.grid.addBackstitch(a, c, b);
        this.drawBackstitch(this.gridCtx, a, c);
        AutoSave.save()
    },
    erase: function(a, d) {
        if (!this.isClipValid(a, d)) {
            return
        }
        var c = this.grid.clearBackstitch(a, d, 15);
        if (this.isClipValid(a + 1, d)) {
            c |= this.grid.clearBackstitch(a + 1, d, this.BS_LEFT)
        }
        if (this.isClipValid(a, d + 1)) {
            c |= this.grid.clearBackstitch(a, d + 1, this.BS_TOP)
        }
        var b = this.indexAt(a, d);
        if (b != this.bgIndex) {
            cdoPalette.changeColourUsage(b, -1);
            this.grid.setIndex(a, d, this.bgIndex);
            cdoPalette.changeColourUsage(this.bgIndex, 1)
        }
        if (c) {
            this.drawGrid(this.gridCtx);
            if (this.isClipValid(a - 1, d)) {
                this.drawGridDesel(this.gridCtx, a - 1, d)
            }
            if (this.isClipValid(a, d - 1)) {
                this.drawGridDesel(this.gridCtx, a, d - 1)
            }
            if (this.isClipValid(a + 1, d)) {
                this.drawGridDesel(this.gridCtx, a + 1, d)
            }
            if (this.isClipValid(a, d + 1)) {
                this.drawGridDesel(this.gridCtx, a, d + 1)
            }
        }
        if (b != this.bgIndex || c) {
            this.drawGridDesel(this.gridCtx, a, d);
            AutoSave.save()
        }
    },
    rotateCW: function() {
        var l = this.grid.width;
        var e = this.grid.height;
        var a = new DeselGrid(e, l, this.bgIndex);
        for (var j = 0; j < e; j++) {
            for (var k = 0; k < l; k++) {
                var f = e - 1 - j;
                var d = k;
                var c = this.grid.index(k, j);
                a.setIndex(f, d, c);
                var g = this.grid.backstitch(k, j);
                if (g & this.BS_LEFT) {
                    a.addBackstitch(f, d, this.BS_TOP)
                }
                if ((g & this.BS_TOP) && f + 1 < e) {
                    a.addBackstitch(f + 1, d, this.BS_LEFT)
                }
                if (g & this.BS_BACK) {
                    a.addBackstitch(f, d, this.BS_FORWARD)
                }
                if (g & this.BS_FORWARD) {
                    a.addBackstitch(f, d, this.BS_BACK)
                }
            }
        }
        this.widthField.value(e);
        this.heightField.value(l);
        this.deselRatio = 1 / this.deselRatio;
        this.grid = a;
        this.resetZoom()
    },
};

function designGridInit() {
    var a = document.getElementById("designGridCanvas");
    if (!a.getContext) {
        return
    }
    designGrid.init()
}

function DeselGrid_empty(a, c) {
    var b = this.grid.at(a, c);
    return b.b == 0
}

function DeselGrid_backstitch(a, c) {
    var b = this.grid.at(a, c);
    return b.b
}

function DeselGrid_addBackstitch(c, f, a) {
    var e = this.grid.at(c, f);
    e.b |= a
}

function DeselGrid_clearBackstitch(c, g, a) {
    var f = this.grid.at(c, g);
    var e = f.b;
    f.b &= ~a;
    return e != f.b
}

function DeselGrid_setBackstitch(c, e, a, d) {
    if (d) {
        this.addBackstitch(c, e, a)
    } else {
        this.clearBackstitch(c, e, a)
    }
}

function DeselGrid_index(a, c) {
    var b = this.grid.at(a, c);
    return b.i
}

function DeselGrid_setIndex(a, e, b) {
    var c = this.grid.at(a, e);
    c.i = b
}

function DeselGrid_toString(f) {
    var k = 2 + this.width * this.height + this.height;
    var c = new Array(k);
    var e = 0;
    c[e++] = B64Coder.encodeNumber(this.width, 12);
    c[e++] = B64Coder.encodeNumber(this.height, 12);
    var a = new B64StreamCoder();
    for (var j = 0; j < this.height; j++) {
        a.startEncode();
        for (var b = 0; b < this.width; b++) {
            var g = this.grid.at(b, j);
            a.put(g.i, f)
        }
        c[e++] = a.finishEncode()
    }
    for (var j = 0; j < this.height; j++) {
        for (var b = 0; b < this.width; b++) {
            var g = this.grid.at(b, j);
            c[e++] = B64Coder.toChar.charAt(g.b)
        }
    }
    var h = c.join("");
    return h
}

function DeselGrid_fromString(o, k, j) {
    var h = 0;
    var e = this.grid;
    this.width = B64Coder.decodeNumberU(o.slice(h, h + 2), 12);
    h += 2;
    this.height = B64Coder.decodeNumberU(o.slice(h, h + 2), 12);
    h += 2;
    var q = this.height,
        g = this.width,
        a = 0,
        p = 0;
    if (this.width != this.grid.width || this.height != this.grid.height) {
        q = 0;
        g = 0;
        a = this.width;
        p = this.height
    }
    this.grid = new Array2D(this.width, this.height, null);
    var n = Math.ceil(this.width * j / 6);
    var c = new B64StreamCoder();
    for (var u = 0; u < this.height; u++) {
        var s = o.slice(h, h + n);
        h += n;
        c.startDecode(s);
        for (var f = 0; f < this.width; f++) {
            var m = new Desel();
            m.i = c.get(j);
            this.grid.setAt(f, u, m);
            if (f < g || f > a || u < q || u > p) {
                if (m.i != e.at(f, u).i) {
                    g = Math.min(g, f);
                    q = Math.min(q, u);
                    a = Math.max(a, f);
                    p = Math.max(p, u)
                }
            }
        }
    }
    if (k >= 2) {
        for (var u = 0; u < this.height; u++) {
            for (var f = 0; f < this.width; f++) {
                var m = this.grid.at(f, u);
                m.b = B64Coder.fromChar[o.charAt(h++)];
                if (f < g || f > a || u < q || u > p) {
                    if (m.b != e.at(f, u).b) {
                        g = Math.min(g, f);
                        q = Math.min(q, u);
                        a = Math.max(a, f);
                        p = Math.max(p, u)
                    }
                }
            }
        }
    }
    return {
        l: g,
        t: q,
        r: a,
        b: p
    }
}

function DeselGrid_setWidth(a, c) {
    this.width = a;
    this.grid.width = a;
    for (var f = 0; f < this.height; f++) {
        for (var b = this.grid.array[f].length; b < this.width; b++) {
            var e = new Desel();
            e.i = c;
            this.grid.setAt(b, f, e)
        }
    }
}

function DeselGrid_setHeight(b, e) {
    var c = this.height;
    this.height = b;
    this.grid.height = b;
    for (var g = c; g < this.height; g++) {
        if (!this.grid.array[g]) {
            this.grid.array[g] = new Array(this.width)
        }
        for (var a = 0; a < this.width; a++) {
            if (!this.grid.at(a, g)) {
                var f = new Desel();
                f.i = e;
                this.grid.setAt(a, g, f)
            }
        }
    }
}

function DeselGrid_copy(e, n, a, o, h, c, m) {
    for (var p = 0; p < o; p++) {
        for (var b = 0; b < a; b++) {
            var l = e + b;
            var k = n + p;
            var g = c + b;
            var f = m + p;
            if (this.isValid(l, k) && h.isValid(g, f)) {
                var j = this.grid.at(l, k);
                if (j) {
                    h.grid.setAt(g, f, new Desel(j.b, j.i))
                }
            }
        }
    }
}

function DeselGrid_isValid(a, b) {
    if (a < 0 || this.width <= a) {
        return false
    }
    if (b < 0 || this.height <= b) {
        return false
    }
    return true
}

function DeselGrid(d, b, a) {
    this.width = d;
    this.height = b;
    this.grid = new Array2D(d, b, null);
    for (var e = 0; e < b; e++) {
        for (var c = 0; c < d; c++) {
            this.grid.setAt(c, e, new Desel(0, a))
        }
    }
    this.empty = DeselGrid_empty;
    this.backstitch = DeselGrid_backstitch;
    this.addBackstitch = DeselGrid_addBackstitch;
    this.clearBackstitch = DeselGrid_clearBackstitch;
    this.setBackstitch = DeselGrid_setBackstitch;
    this.index = DeselGrid_index;
    this.setIndex = DeselGrid_setIndex;
    this.toString = DeselGrid_toString;
    this.fromString = DeselGrid_fromString;
    this.setWidth = DeselGrid_setWidth;
    this.setHeight = DeselGrid_setHeight;
    this.isValid = DeselGrid_isValid;
    this.copy = DeselGrid_copy
}

function Desel(a, b) {
    this.b = a ? a : 0;
    this.i = b ? b : 0;
    this.equals = function(c) {
        return this.b == c.b && this.i == c.i
    }
}

function Array2D_at(a, b) {
    return this.array[b][a]
}

function Array2D_setAt(a, c, b) {
    this.array[c][a] = b
}

function Array2D_toString() {
    return "" + this.width + "," + this.height + "," + this.array.toString()
}

function Array2D_fromString(e) {
    var c = e.split(",");
    this.width = Number(c[0]);
    this.height = Number(c[1]);
    this.array = new Array(this.height);
    var a = 2;
    for (var d = 0; d < this.height; d++) {
        this.array[d] = new Array(this.width);
        for (var b = 0; b < this.width; b++) {
            this.array[d][b] = c[a++]
        }
    }
}

function Array2D(c, a, e) {
    this.width = c;
    this.height = a;
    this.array = new Array(a);
    for (var d = 0; d < this.height; d++) {
        this.array[d] = new Array(this.width);
        for (var b = 0; b < this.width; b++) {
            this.array[d][b] = e
        }
    }
    this.at = Array2D_at;
    this.setAt = Array2D_setAt;
    this.toString = Array2D_toString;
    this.fromString = Array2D_fromString
}

function CellShapeSlider(d, c, b) {
    this.cb = b;
    this.thumb = document.getElementById(d);
    this.canvas = document.getElementById(c);
    this.rangeX = this.canvas.clientWidth - this.thumb.clientWidth;
    this.rangeY = this.canvas.clientHeight - this.thumb.clientHeight;
    this.ctx = this.canvas.getContext("2d");
    this.slider = new PgSlider(d, function(g, j, h) {
        h.newPos(g, j)
    }, this, function(g) {
        g.setDone()
    });
    this.setRatio = function(g) {
        this.angle = this.ratioToAngle(g);
        var h = this.angleToUnitPos(this.angle);
        this.slider.setPos(h.x, h.y, "noNotify");
        this.draw()
    };
    this.newPos = function(g, h) {
        this.angle = this.posToAngle(g, h);
        this.draw()
    };
    this.setDone = function() {
        var g = this.closestRatio(this.angle);
        this.cb(g.ratio)
    };
    this.limitPix = function(g, n) {
        var j = this.posToAngle(g, n);
        j = Math.min(Math.max(0, j), Math.PI / 2);
        var m = this.angleToUnitPos(j);
        var h = m.x * this.rangeX;
        var k = m.y * this.rangeY;
        return this.sliderLim.call(this.slider, h, k)
    };
    this.sliderLim = this.slider.limitPix;
    this.slider.limiter = this;
    this.slider.limitPix = this.limitPix;
    this.ratioToAngle = function(g) {
        return Math.atan(1 / g)
    };
    this.angleToRatio = function(g) {
        var h = this.boxBR(g);
        return h.r / h.b
    };
    this.poss = [];
    for (var a = 1; a <= 10; a++) {
        for (var f = 1; f <= 10; f++) {
            var e = a / f;
            if (a + f < 12 && !this.poss[e]) {
                this.poss[e] = {
                    angle: this.ratioToAngle(e),
                    ratio: e,
                    x: a,
                    y: f
                }
            }
        }
    }
    this.boxBR = function(h) {
        var k = this.angleToUnitPos(h);
        var j = k.x * this.rangeX + this.thumb.clientWidth / 2;
        var g = k.y * this.rangeY + this.thumb.clientHeight / 2;
        return {
            r: j,
            b: g
        }
    };
    this.posToAngle = function(g, h) {
        return Math.atan2(h, g)
    };
    this.angleToUnitPos = function(h) {
        var g = Math.cos(h);
        var j = Math.sin(h);
        return {
            x: g,
            y: j
        }
    };
    this.draw = function() {
        var j = this.boxBR(this.angle);
        this.ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(1, 0);
        this.ctx.lineTo(1, j.b);
        this.ctx.lineTo(j.r, j.b);
        this.ctx.lineTo(j.r, 1);
        this.ctx.lineTo(0, 1);
        this.ctx.stroke();
        var h = this.closestRatio(this.angle);
        var g = "" + h.x + ":" + h.y;
        this.ctx.font = "16px Arial";
        this.ctx.fillText(g, this.canvas.clientWidth * 0.6, this.canvas.clientHeight - 3)
    };
    this.closestRatio = function(g) {
        var k = new TrackMin(0, 1000);
        for (var h in this.poss) {
            var j = Math.abs(g - this.poss[h].angle);
            k.update(h, j)
        }
        return this.poss[k.id]
    }
}
var pgTracing = {
    dataUrl: "",
    imgOffX: 0,
    imgOffY: 0,
    imgZoom: 1,
    tracingCanvas: null,
    tracingCtx: null,
    imgCanvas: null,
    imgCtx: null,
    img: null,
    slider: null,
    imgData: null,
    alpha: 0.5,
    loaded: false,
    init: function() {
        DesIO.register("TR", function(a) {
            pgTracing.fromString(a)
        }, function() {
            return pgTracing.toString()
        });
        this.tracingCanvas = document.getElementById("designGridTracingCanvas");
        this.imgCanvas = document.getElementById("designGridImageCanvas");
        this.getCtx();
        this.img = document.getElementById("designGridTracingImage");
        this.resetImageZoom()
    },
    toString: function() {
        if (!this.dataUrl) {
            return ""
        }
        var c = new Array(7);
        var b = 0;
        var a = 2;
        c[b++] = B64Coder.encodeNumber(a, 12);
        c[b++] = B64Coder.encodeNumber(this.dataUrl.length, 24);
        c[b++] = this.dataUrl;
        c[b++] = B64Coder.encodeNumber(Math.round(this.imgOffX * 1000), 30);
        c[b++] = B64Coder.encodeNumber(Math.round(this.imgOffY * 1000), 30);
        c[b++] = B64Coder.encodeNumber(Math.round(this.imgZoom * 1000), 24);
        c[b++] = B64Coder.encodeNumber(Math.round(this.alpha * 1000), 12);
        c[b++] = B64Coder.encodeNumber(Math.round(pgMagicUtils.dither * 1000), 12);
        c[b++] = B64Coder.encodeNumber(Math.round(pgMagicUtils.definition * 1000), 12);
        var d = c.join("");
        return d
    },
    fromString: function(c) {
        if (!c) {
            this.removeData();
            return
        }
        var d = new StringDecoder(c);
        var a = d.getNumU(2);
        var b = d.getNumU(4);
        this.dataUrl = d.getStr(b);
        this.imgOffX = d.getNumS(5) / 1000;
        this.imgOffY = d.getNumS(5) / 1000;
        this.imgZoom = d.getNumU(4) / 1000;
        this.internalSetAlpha(d.getNumU(2) / 1000);
        if (a >= 1) {
            pgMagicUtils.setDither(d.getNumU(2) / 1000)
        }
        if (a >= 2) {
            pgMagicUtils.setDefinition(d.getNumU(2) / 1000)
        }
        d.checkEnd();
        this.loadImage(false)
    },
    newImage: function(a) {
        this.dataUrl = a;
        this.loadImage(true)
    },
    getCtx: function() {
        this.tracingCtx = this.tracingCanvas.getContext("2d");
        this.imgCtx = this.imgCanvas.getContext("2d");
        this.imgCtx.globalAlpha = this.alpha
    },
    resetImageZoom: function() {
        this.imgZoom = 1;
        this.internalSetAlpha(0.5);
        AutoSave.save("quiet");
        if (!this.img || !this.img.width) {
            return
        }
        this.imgOffX = (designGrid.width() - this.img.width / designGrid.deselWidth) / 2;
        this.imgOffY = (designGrid.height() - this.img.height / designGrid.deselSize) / 2
    },
    resetSettings: false,
    loadImage: function(a) {
        if (!this.img) {
            return
        }
        this.loaded = false;
        this.resetSettings = a;
        var b = $(this.img);
        b.off("load");
        this.img.src = "";
        b.load(function() {
            pgTracing.imageLoaded()
        });
        this.img.src = this.dataUrl
    },
    imageLoaded: function() {
        var a = $(this.img);
        a.off("load");
        if (this.resetSettings) {
            this.resetImageZoom();
            this.resetSettings = false
        }
        this.loaded = true;
        this.draw();
        loadTracingComplete();
        this.settingsStart()
    },
    draw: function() {
        if (!this.img || !this.img.width || !this.loaded) {
            return
        }
        this.tracingCtx.clearRect(0, 0, this.tracingCanvas.width, this.tracingCanvas.height);
        this.imgCtx.clearRect(0, 0, this.imgCanvas.width, this.imgCanvas.height);
        var f = designGrid.deselWidth / designGrid.naturalDeselWidth;
        var b = f * this.imgZoom;
        var e = designGrid.deselSize / designGrid.naturalDeselSize;
        var a = e * this.imgZoom;
        var o = designGrid.offXBase + designGrid.deselWidth * this.imgOffX;
        var n = designGrid.offY + designGrid.deselSize * this.imgOffY;
        var m = -o / b;
        var h = -n / a;
        var l = 0;
        var g = 0;
        if (m < 0) {
            l = -m * b;
            m = 0
        }
        if (h < 0) {
            g = -h * a;
            h = 0
        }
        if (m > this.img.width || h > this.img.height) {
            return
        }
        var k = this.imgCanvas.width;
        var d = this.imgCanvas.height;
        var j = (k - o) / b;
        var c = (d - n) / a;
        if (j > this.img.width) {
            j = this.img.width;
            k = o + j * b
        }
        if (c > this.img.height) {
            c = this.img.height;
            d = n + c * a
        }
        if (k < 0 || d < 0) {
            return
        }
        this.tracingCtx.fillStyle = cdoPalette.colour(0);
        this.tracingCtx.fillRect(0, 0, this.tracingCanvas.width, this.tracingCanvas.height);
        this.tracingCtx.drawImage(this.img, m, h, j - m, c - h, l, g, k - l, d - g);
        this.imgCtx.drawImage(this.img, m, h, j - m, c - h, l, g, k - l, d - g);
        this.imgData = this.tracingCtx.getImageData(0, 0, this.tracingCanvas.width, this.tracingCanvas.height);
        pgMenu.setClassVisible("tracingItem", true)
    },
    settingsStart: function() {
        this.enableButtons(true);
        if (!this.slider) {
            this.slider = new PgSlider("imageAlphaSliderThumb", function(a, b) {
                pgTracing.alphaSliderChange(a, b)
            })
        }
        this.slider.setPos(0, 1 - this.alpha, "noNotify")
    },
    settingsDone: function() {
        this.enableButtons(false)
    },
    enableButtons: function(a) {
        toolBox.setEnabled("toolMagicPen", a);
        toolBox.setEnabled("toolMagicBrush", a);
        toolBox.setEnabled("toolTracingPickColour", a);
        toolBox.setEnabled("toolMagicFill", a);
        toolBox.setEnabled("toolTracingScroll", a);
        if (a) {
            $(".tracingTool").removeClass("disabledAction")
        } else {
            $(".tracingTool").addClass("disabledAction")
        }
    },
    removeData: function() {
        this.dataUrl = "";
        this.imgData = null;
        this.loaded = false;
        pgMenu.setClassVisible("tracingItem", false);
        this.tracingCtx.clearRect(0, 0, this.tracingCanvas.width, this.tracingCanvas.height);
        this.imgCtx.clearRect(0, 0, this.imgCanvas.width, this.imgCanvas.height);
        this.settingsDone()
    },
    removeImage: function() {
        this.removeData();
        AutoSave.save("quiet")
    },
    scrollBy: function(b, a) {
        var c = designGrid.deselSize;
        this.imgOffX += b / c;
        this.imgOffY += a / c;
        this.draw();
        AutoSave.save("quiet");
        return {
            dx: b,
            dy: a
        }
    },
    setSufficientAlpha: function() {
        if (this.alpha < 0.5) {
            this.internalSetAlpha(0.5)
        }
    },
    zoomFactor: 1.05,
    zoomBy: function(h) {
        var f = designGrid.width() * designGrid.deselWidth;
        var e = designGrid.height() * designGrid.deselSize;
        var d = this.img.width * this.imgZoom;
        var b = this.img.height * this.imgZoom;
        if ((d < f * 0.999 && d * h > f * 1.001) || (d * h < f * 0.999 && d > f * 1.001)) {
            h = f / d
        }
        if ((b < e * 0.999 && b * h > e * 1.001) || (b * h < e * 0.999 && b > e * 1.001)) {
            h = e / b
        }
        this.setSufficientAlpha();
        var a = designGrid.width() / 2;
        var g = designGrid.height() / 2;
        this.imgOffX = a + (this.imgOffX - a) * h;
        this.imgOffY = g + (this.imgOffY - g) * h;
        this.imgZoom *= h;
        this.draw();
        AutoSave.save("quiet");
        toolBox.selectTool("toolTracingScroll")
    },
    zoomIn: function() {
        this.zoomBy(this.zoomFactor)
    },
    zoomOut: function() {
        this.zoomBy(1 / this.zoomFactor)
    },
    scrollActivated: function() {
        this.setSufficientAlpha();
        AutoSave.save("quiet")
    },
    deselNaturalSizeChanged: function(a, b) {
        this.imgOffX /= a;
        this.imgOffY /= b;
        this.draw()
    },
    alphaSliderChange: function(a, b) {
        this.alpha = 1 - b;
        AutoSave.save("quiet");
        this.applyAlpha()
    },
    applyAlpha: function() {
        if (!this.imgCtx) {
            return
        }
        this.imgCtx.globalAlpha = this.alpha;
        this.draw()
    },
    internalSetAlpha: function(a) {
        this.alpha = a;
        if (this.slider) {
            this.slider.setPos(0, 1 - this.alpha, "noNotify")
        }
        this.applyAlpha()
    },
};
var toolBox = {
    currentButton: null,
    currentTool: null,
    currentToolBar: null,
    init: function() {
      alert('hii');
        this.toolPen = drawingTools.toolPen;
        this.toolLine = drawingTools.toolLine;
        this.toolRectOutline = drawingTools.toolRectOutline;
        this.toolRectSolid = drawingTools.toolRectSolid;
        this.toolEllipseOutline = drawingTools.toolEllipseOutline;
        this.toolEllipseSolid = drawingTools.toolEllipseSolid;
        this.toolPickColour = drawingTools.toolPickColour;
        this.toolFill = drawingTools.toolFill;
        this.toolText = drawingTools.toolText;
        this.toolBackstitch = drawingTools.toolBackstitch;
        this.toolErase = drawingTools.toolErase;
        this.toolSelect = pgToolSelect;
        this.pgLibraryToolSelect = pgLibraryToolSelect;
        this.dgZoom = new ZoomTools(designGrid);
        this.toolScroll = this.dgZoom.toolScroll;
        this.toolZoomIn = this.dgZoom.toolZoomIn;
        this.toolZoomOut = this.dgZoom.toolZoomOut;
        this.pgLibraryToolRotateCW = pgLibraryToolRotateCW;
        this.trZoom = new ZoomTools(pgTracing);
        this.toolTracingScroll = this.trZoom.toolScroll;
        this.toolTracingZoomIn = this.trZoom.toolZoomIn;
        this.toolTracingZoomOut = this.trZoom.toolZoomOut;
        this.toolTracingPickColour = pgToolColourPicker;
        this.toolMagicPen = pgToolMagicPen;
        this.toolMagicBrush = pgToolMagicBrush;
        this.toolMagicFill = pgToolMagicFill;
        var a = $(".toolButton");
        a.each(function(c, b) {
          alert(12)
            if (!b.onclick) {
                b.onclick = function() {

                    toolBox.toolClicked(this)
                }
            }
        });
        this.selectToolBar("mainToolbox")
    },
    selectToolBar: function(a) {
        var b = $("#" + a);
        if (!b.length) {
            return
        }
        if (b.is(this.currentToolBar)) {
            return
        }
        if (this.currentToolBar) {
            this.currentToolBar.addClass("hideMe")
        }
        this.currentToolBar = b;
        this.currentToolBar.removeClass("hideMe");
        this.selectDefaultTool()
    },
    selectDefaultTool: function() {
        var a = this.currentToolBar.attr("defaultTool");
        if (a) {
            this.selectTool(a)
        }
    },
    toolClicked: function(a) {
        if ($("#" + a.id).hasClass("disabledAction")) {
            return
        }
        this.selectTool(a.id)
    },
    selectTool: function(b) {
        var a = $("#" + b);
        if (this.setTool(a.attr("id")) == "change") {
            if (this.currentButton) {
                this.currentButton.removeClass("currentTool")
            }
            this.currentButton = a;
            this.currentButton.addClass("currentTool")
        }
    },
    setEnabled: function(c, b) {
        var a = $("#" + c);
        a.toggleClass("disabledAction", !b);
        a.prop("disabled", !b);
        if (!b && c == this.currentToolId()) {
            this.selectDefaultTool()
        }
    },
    setTool: function(b) {
        var a = this[b];
        if (a) {
            if (a.click) {
                a.click();
                return "nochange"
            }
            if (this.currentTool != a) {
                if (this.currentTool && this.currentTool.deactivate) {
                    this.currentTool.deactivate()
                }
            }
            this.currentTool = a;
            if (a.activate) {
                a.activate()
            }
        }
        return "change"
    },
    currentToolId: function() {
        if (this.currentButton) {
            return this.currentButton.attr("id")
        } else {
            return ""
        }
    },
};


var AppData = {};
$(document).ready(function() {
    patternGridInit()
});

function patternGridInit() {
    if (AppData.name) {
        return
    }
    AutoSave.pause();
    AppData.name = "DESG";
    if (!$("#patternGridMenu").length) {
        return
    }
    pgMenu.init("#patternGridMenu");
    colourSource.init();
    paletteInit();
    designGridInit();
    pgTracing.init();
    colourSource.linkTo(function(a) {
        cdoPalette.setId(a)
    });
    cdoPalette.linkTo(function(a) {
        designGrid.setColour(a)
    }, function(a) {
        designGrid.setPaletteIndex(a);
        colourSource.showId(cdoPalette.id(a))
    }, function(a, b) {
        designGrid.remapColours(a, b)
    });
    toolBox.init();
    threadLength.init();
    appMenuInit();
    colourSource.setId(colourSource.idByColour("#ff0000"));
    initialLoad();
    $(window).on("beforeunload", function() {
        AutoSave.immediate()
    });
    AutoSave.restart()
}

function completeLoad() {
    colourSource.showId(cdoPalette.id(cdoPalette.currentIndex));
    toolBox.selectTool("toolPen")
}

function hookLoadFileBrowse() {
    var a = $("#loadFile").contents().find("#loadFileBrowse");
    if (a.length) {
        a.off("change");
        a.change(function(b) {
            loadButtonClicked(b)
        })
    }
}

function initialLoad() {
    var b = "";
    var a = $("#initLoadData");
    if (a.length) {
        b = a.text();
        a.text("done")
    }
    if (b == "done") {
        return
    }
    if (b) {
        DesIO.loadFromStr(AppData.name, b, true)
    } else {
        DesIO.load(AppData.name)
    }
    completeLoad()
}

function loadPattern() {
    try {
        hookLoadFileBrowse();
        $("#busySpinner").addClass("hideMe");
        if (!AppData.name) {
            return
        }
        var b = "";
        var a = $("#loadFile").contents().find("#loadData");
        if (a.length) {
            b = a.text();
            a.text("")
        }
        if (b) {
            DesIO.loadFromStr(AppData.name, b, true);
            completeLoad();
            AutoSave.save()
        } else {
            initialLoad()
        }
    } catch (c) {}
}
pgGridSizePopup = new PgPopup("#gridSizePopup");
pgColoursPopup = new PgPopup("#coloursPopup");
pgFileLoadPopup = new PgPopup("#fileLoadPopup");
pgTracingPopup = new PgPopup("#tracingPopup");

function clearIframeFileField(b, d) {
    var a = $("#" + b);
    var c = a.contents().find("#" + d);
    c.val("")
}

function appMenuInit() {
    pgMenu.MenuItemFileSaveToMyPatterns = function() {
        uploadButtonClicked(null)
    };
    pgMenu.MenuItemFileSaveFile = function() {
        saveButtonClicked(null)
    };
    pgMenu.MenuItemFileLoadFile = function() {
        clearIframeFileField("loadFile", "loadFileBrowse");
        pgFileLoadPopup.show()
    };
    pgMenu.MenuItemFileChartHtml = function() {
        htmlChartClicked()
    };
    pgMenu.MenuItemEditUndo = function() {
        UndoRedo.undoClicked()
    };
    pgMenu.MenuItemEditRedo = function() {
        UndoRedo.redoClicked()
    };
    pgMenu.MenuItemEditClear = function() {
        newButtonClicked(null)
    };
    pgMenu.MenuItemEditGridSize = function() {
        pgGridSizePopup.show();
        designGrid.gridPopupShown(pgGridSizePopup)
    };
    pgMenu.MenuItemEditColours = function() {
        pgColoursPopup.show()
    };
    pgMenu.MenuItemTracingAuto = function() {
        startAutoTracing()
    };
    pgMenu.MenuItemTracingSetImage = function() {
        startLoadTracingPopup()
    };
    pgMenu.MenuItemTracingRemoveImage = function() {
        pgTracing.removeImage()
    };
    pgMenu.MenuItemTracingSettings = function() {
        pgTracingPopup.show();
        pgMagicUtils.setupSlider()
    };
    pgMenu.MenuItemLibraryGet = function() {
        pgLibrary.startBrowse()
    };
    pgMenu.MenuItemLibraryAdd = function() {
        pgLibrary.addToLibrary()
    }
}

function stripFileNameNumbers(b) {
    if (!b) {
        return b
    }
    var c = b.lastIndexOf(".");
    var d = c == -1 ? "" : b.substr(c);
    var e = c == -1 ? b : b.substr(0, c);
    var a = "() 0123456789-";
    while (e && a.indexOf(e[e.length - 1]) != -1) {
        e = e.substr(0, e.length - 1)
    }
    return e + d
}

function loadButtonClicked(b) {
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        var d = b.target.files[0];
        var c = stripFileNameNumbers(d.name);
        if (c && $("#saveDataName")) {
            $("#saveDataName").attr("value", c)
        }
        var a = new FileReader();
        a.onload = (function(e) {
            return function(f) {
                DesIO.loadFromStr(AppData.name, f.target.result, true);
                completeLoad();
                AutoSave.save()
            }
        })(d);
        a.readAsText(d)
    } else {
        $("#busySpinner").removeClass("hideMe");
        $("#loadFile").contents().find("#loadForm").submit()
    }
    pgFileLoadPopup.hide()
}

function saveButtonClicked(a) {
    if (window.BlobBuilder && window.FileSaver) {}
    prepSaveData();
    $("#remoteSaveForm").submit()
}

function clearSaved() {
    clearTimeout(AutoSave.timer);
    DesIO.remove(AppData.name)
}

function prepSaveData() {
    var d = DesIO.getState(AppData.name);
    $("#saveDataField").attr("value", d);
    var b = $("#loadFile");
    if (!b) {
        return
    }
    var c = b.contents().find("#cdo_patternname");
    if (c && $("#saveDataName")) {
        var a = stripFileNameNumbers(c.attr("value"));
        if (a) {
            $("#saveDataName").attr("value", a)
        }
    }
}

function uploadButtonClicked(a) {
    threadLength.measure();
    var b = DesIO.getState(AppData.name);
    $("#uploadDataField").attr("value", b);
    $("#uploadForm").submit()
}

function newButtonClicked(a) {
    AutoSave.immediate();
    var b = $("#loadFile");
    if (!b) {
        return
    }
    var c = b.contents().find("#cdo_patternname");
    if (c) {
        c.attr("value", "")
    }
    $("#saveDataName").attr("value", "pattern.grid");
    cdoPalette.reset();
    designGrid.reset();
    colourSource.setId(colourSource.idByColour("#ff0000"));
    toolBox.selectToolBar("mainToolbox");
    toolBox.selectTool("toolPen");
    AutoSave.immediate()
}
pgLoadTracingPopup = new PgPopup("#loadTracingPopup");
pgAutoTracingPopup = new PgPopup("#autoTracingPopup");

function imageModeSelected() {
    if (pgTracing.dataUrl) {
        pgTracing.settingsStart()
    } else {
        $("#tracingMenu").click();
        $("#MenuItemTracingSetImage").click()
    }
}

function startLoadTracingPopup() {
    clearIframeFileField("loadTracing", "loadTracingBrowse");
    pgLoadTracingPopup.show()
}

function loadTracingPopupBrowseClicked(c, b, e) {
    loadTracingMode = e;
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        var d = c.target.files[0];
        var a = new FileReader();
        a.onload = (function(f) {
            return function(g) {
                loadTracingData(g.target.result)
            }
        })(d);
        a.readAsDataURL(d)
    } else {
        $("#busySpinner").removeClass("hideMe");
        $("#" + e + "Tracing").contents().find("#loadTracingForm").submit()
    }
    b.hide()
}
loadTracingData_origData = "";
loadTracingData_tempImg = null;

function loadTracingData(a) {
    pgTracing.loaded = false;
    loadTracingData_origData = a;
    loadTracingData_tempImg = document.getElementById("designGridTracingImage");
    $(loadTracingData_tempImg).load(function() {
        $(loadTracingData_tempImg).off("load");
        var d = document.getElementById("designGridTracingCanvas");
        var j = loadTracingData_tempImg;
        var g = d.width;
        var b = d.height;
        var f = Math.min(g / j.width, b / j.height);
        var n = j.width * f;
        var k = j.height * f;
        d.width = n;
        d.height = k;
        var c = d.getContext("2d");
        c.drawImage(j, 0, 0, n, k);
        var m = loadTracingData_origData.substring(5, loadTracingData_origData.search(";"));
        var o = d.toDataURL(m);
        d.width = g;
        d.height = b;
        var e = o.length;
        var l = loadTracingData_origData.length;
        if (e < l) {
            loadTracingDataSetData(o)
        } else {
            loadTracingDataSetData(loadTracingData_origData)
        }
    }).attr("src", a)
}

function loadTracingDataSetData(a) {
    designGrid.resetZoom();
    pgTracing.newImage(a)
}

function hookLoadTracingBrowse() {
    var a = $("#loadTracing").contents().find("#loadTracingBrowse");
    if (a.length) {
        a.off("change");
        a.change(function(c) {
            loadTracingPopupBrowseClicked(c, pgLoadTracingPopup, "load")
        })
    }
    var b = $("#autoTracing").contents().find("#loadTracingBrowse");
    if (b.length) {
        b.off("change");
        b.change(function(c) {
            loadTracingPopupBrowseClicked(c, pgAutoTracingPopup, "auto")
        })
    }
}
loadTracingMode = "load";

function loadTracingDataForm(d) {
    hookLoadTracingBrowse();
    $("#busySpinner").addClass("hideMe");
    var b = "";
    var a = $(d.document).contents().find("#loadTracingData");
    if (a.length) {
        b = $(a).val();
        $(a).val("")
    }
    var c = $(d.document).contents().find("#loadTracingMode");
    if (c.length) {
        loadTracingMode = c.val()
    }
    if (b) {
        loadTracingData(b)
    }
}

function htmlChartClicked() {
    threadLength.measure();
    AutoSave.immediate();
    var b = DesIO.getState(AppData.name);
    $("#chartDataField").attr("value", b);
    var a = designGrid.snapshot();
    $("#chartImageField").attr("value", a);
    $("#chartForm").submit()
}

function startAutoTracing() {
    if (pgTracing.imgData) {
        autoTracing.start()
    } else {
        clearIframeFileField("autoTracing", "loadTracingBrowse");
        var a = $("#autoTracing").contents().find("#loadTracingMode");
        if (a.length) {
            a.val("auto")
        }
        pgAutoTracingPopup.show()
    }
}

function loadTracingComplete() {
    var a = loadTracingMode;
    loadTracingMode = "load";
    if (a == "auto") {
        startAutoTracing()
    }
}

function undoClicked() {
    UndoRedo.undoClicked()
}

function redoClicked() {
    UndoRedo.redoClicked()
}
TextUtil = {
    fonts: null,
    fontList: function() {
        if (!this.fonts) {
            var c = new FontDetector;
            var b = ["sans-serif", "serif", "monospace", "American Typewriter", "Andale Mono", "Antiqua", "Apple Chancery", "Arial", "Arial Black", "Arial Bold", "Arial Bold Italic", "Arial Italic", "Avqest", "Baskerville", "Big Caslon", "Blackletter", "Brush Script", "Calibri", "Capitals", "Charcoal", "Charter", "Clean", "Comic Sans MS", "Comic Sans MS Bold", "Copperplate", "Courier", "Courier New", "Courier New Bold", "Courier New Bold Italic", "Courier New Italic", "cursive", "Decorative", "fantasy", "Fixed", "Fraktur", "Frosty", "Futura", "Gadget", "Garamond", "Georgia", "Georgia Bold", "Georgia Bold Italic", "Georgia Italic", "Gill Sans", "Helvetica", "Herculanum", "Hoefler Text", "Hoefler Text Ornaments", "Impact", "Lucida", "Lucida bright", "Lucida Console", "Lucida Grande", "Lucida Sans Unicode", "Lucida Typewriter", "Marker Felt", "Marlett", "Minion", "Minion Web", "Modern", "New Century Schoolbook", "Optima", "Osaka", "Palatino", "Papyrus", "Roman", "Sand", "Script", "Skia", "Small fonts", "Swiss", "Symbol", "Tahoma", "Techno", "Terminal", "Textile", "Times", "Times New Roman", "Times New Roman Bold", "Times New Roman Bold Italic", "Times New Roman Italic", "Trebuchet MS", "Trebuchet MS Bold", "Trebuchet MS Bold Italic", "Trebuchet MS Italic", "Utopia", "Verdana", "Verdana Bold", "Verdana Bold Italic", "Verdana Italic", "Webdings", "Zapf Dingbats", "Zapfino"];
            this.fonts = new Array();
            for (var a = 0; a < b.length; a++) {
                if (c.detect(b[a])) {
                    this.fonts.push(b[a])
                }
            }
        }
        return this.fonts
    },
    canvas: null,
    ctx: null,
    createCanvas: function() {
        if (this.canvas) {
            return
        }
        this.canvas = document.createElement("canvas");
        this.canvas.width = 600;
        this.canvas.height = 600;
        this.ctx = this.canvas.getContext("2d")
    },
    weight: 100,
    textImage: function(o, b, m, h, g) {
        this.createCanvas();
        this.ctx.clearRect(0, 0, 600, 600);
        this.ctx.fillStyle = "#000000";
        var d = this.fontSpec(b, m, h, g);
        this.ctx.font = d;
        var c = this.ctx.measureText(o);
        var p = this.getTextHeight(d);
        this.ctx.fillText(o, 0, p.ascent);
        var k = Math.max(1, c.width);
        var e = this.ctx.getImageData(0, 0, k, p.height);
        var n = 600;
        var j = 0;
        for (var f = 3; f < e.data.length; f += 4) {
            var a = 0;
            if (e.data[f] >= this.weight) {
                a = 255;
                var l = (f / 4) % k;
                n = Math.min(n, l);
                j = Math.max(j, l)
            }
            e.data[f] = a
        }
        this.textWidth = 1 + j - n;
        if (this.textWidth > 580) {
            this.textWidth = c.width
        }
        return e
    },
    fontSpec: function(e, d, c, b) {
        var a = "";
        if (b) {
            a += "italic "
        }
        if (c) {
            a += "bold "
        }
        return a + d + "px " + e
    },
    getTextHeight: function(c) {
        var e = $('<span style="font: ' + c + '">Hg</span>');
        var d = $('<div style="display: inline-block; width: 1px; height: 0px;"></div>');
        var f = $("<div></div>");
        f.append(e, d);
        var b = $("body");
        b.append(f);
        try {
            var a = {};
            d.css({
                verticalAlign: "baseline"
            });
            a.ascent = d.offset().top - e.offset().top;
            d.css({
                verticalAlign: "bottom"
            });
            a.height = d.offset().top - e.offset().top;
            a.descent = a.height - a.ascent
        } finally {
            f.remove()
        }
        return a
    },
};
var pgMenu = {
    showing: false,
    currentMenu: null,
    mouseDownCapture: new EventCapturer("mousedown"),
    touchStartCapture: new EventCapturer("touchstart"),
    hideAll: function() {
        $("#patternGridMenu").find("li").removeClass("stickyMenu");
        this.showing = false;
        this.currentMenu = null
    },
    click: function(b) {
        if (b == this.currentMenu) {
            return
        }
        pgMenu.hideAll();
        var d = $(b).parent();
        d.addClass("stickyMenu");
        this.showing = true;
        this.currentMenu = b;
        this.mouseDownCapture.start(function(f) {
            pgMenu.externalClick(f)
        });
        this.touchStartCapture.start(function(f) {
            pgMenu.externalClick(f)
        });
        var a = d.find("ul li");
        var c = 0;
        a.each(function(h, j) {
            var f = $(j);
            var g = Number(f.attr("naturalWidth"));
            if (!g) {
                g = f.width();
                f.attr("naturalWidth", g)
            }
            if (g > c) {
                c = g
            }
        });
        var e = a.find("a");
        e.width(c)
    },
    over: function(a) {
        if (this.showing && a != this.currentMenu) {
            this.externalClick(a);
            this.click(a)
        }
    },
    externalClick: function(b) {
        if (!this.showing) {
            return
        }
        var c = b.target;
        var a = this.currentMenu.parentElement;
        while (c) {
            if (c == a) {
                return
            }
            c = c.parentElement
        }
        this.mouseDownCapture.end();
        this.touchStartCapture.end();
        this.hideAll()
    },
    init: function(a) {
        var c = $(a);
        var b = c.children("ul").children("li");
        b.each(function(e, h) {
            var g = $(h);
            var f = $(g.children("a")[0]);
            f.click(function(j) {
                pgMenu.click(this)
            });
            f.mouseover(function(j) {
                pgMenu.over(this)
            });
            var d = g.find(".pgSubMenu a");
            d.each(function(k, l) {
                var m = $(l);
                m.click(function(j) {
                    pgMenu.item(this.id)
                })
            })
        })
    },
    item: function(b) {
        this.hideAll();
        var a = this[b];
        a()
    },
    setItemVisible: function(b, c) {
        var a = $("#" + b).parent();
        a.toggleClass("hideMe", !c)
    },
    setClassVisible: function(a, c) {
        var b = $("." + a);
        b.toggleClass("hideMe", !c)
    },
};
var KEYCODE_ESC = 27;

function PgPopup(a) {
    if (typeof(a) == "string") {
        this.id = a;
        this.ui = $(a)
    } else {
        this.ui = a;
        this.id = a.attr("id")
    }
    this.titleBar = null;
    this.closeable = false;
    this.isFocused = false;
    this.focusHandlersSet = false;
    this.firstShow = true;
    this.show = function() {
        if (this.ui.length == 0) {
            this.ui = $(a)
        }
        var b = this.ui;
        b.removeClass("hideMe");
        this.forward();
        this.setPosition();
        this.setFocus();
        if (this.firstShow) {
            this.ui.click({
                self: this
            }, function(c) {
                c.data.self.forward()
            })
        }
    };
    this.forward = function() {
        ZOrderManager.focus(this.ui)
    };
    this.setFocus = function() {
        var g = this.ui;
        var l = null;
        var h = g.attr("focus");
        if (h) {
            var d = h.split(" ");
            var c = $(document);
            do {
                l = c.contents().find("#" + d[0]);
                d.shift();
                if (d.length) {
                    c = l
                }
            } while (d.length)
        } else {
            l = g;
            g.attr("tabindex", "-1")
        }
        if (l && !this.isFocused) {
            if (!this.focusHandlersSet) {
                l.focus({
                    popup: this
                }, function(m) {
                    m.data.popup.isFocused = true
                });
                l.blur({
                    popup: this
                }, function(m) {
                    m.data.popup.isFocused = false
                });
                this.focusHandlersSet = true
            }
            l.focus();
            l.select()
        }
        var g = this.ui;
        if (!this.titleBar) {
            this.titleBar = $(a).find("h1");
            this.drag = new Draggable(this.titleBar, this);
            var b = 0;
            var k = $('<span class="popupIcons"></span>');
            this.helpId = this.titleBar.attr("help");
            if (this.helpId) {
                var e = $('<span class="popupIcon">?</span>');
                e.mousedown({
                    popup: this
                }, function(m) {
                    m.data.popup.clickHelp()
                });
                b++;
                k.append(e)
            }
            if (this.titleBar.attr("close")) {
                var f = $('<span class="popupIcon">x</span>');
                f.mousedown({
                    popup: this
                }, function(m) {
                    m.data.popup.clickX()
                });
                b++;
                k.append(f);
                this.closeable = true
            }
            if (b) {
                this.titleBar.append(k);
                var j = this.titleBar.width();
                j += 10;
                g.css("min-width", j)
            }
        }
        g.keydown({
            popup: this
        }, function(m) {
            if (m.keyCode == KEYCODE_ESC) {
                m.data.popup.escapePress()
            }
        });
        l.keydown({
            popup: this
        }, function(m) {
            if (m.keyCode == KEYCODE_ESC) {
                m.data.popup.escapePress()
            }
        })
    };
    this.clickX = function() {
        var b = this.ui;
        b.focus();
        b.blur();
        this.hide()
    };
    this.clickHelp = function() {
        if (!this.helpPopup) {
            this.helpPopup = new PgPopup("#" + this.helpId)
        }
        this.helpPopup.show()
    };
    this.escapePress = function() {
        if (this.closeable) {
            this.hide()
        }
    };
    this.hideCB = null;
    this.hideCBObj = null;
    this.hideCBArgs = null;
    this.hide = function() {
        var b = this.ui;
        b.addClass("hideMe");
        ZOrderManager.hide(this.ui);
        if (this.drag) {
            this.drag.stop()
        }
        if (this.hideCB) {
            this.hideCB.apply(this.hideCBObj, this.hideCBArgs)
        }
    };
    this.setPosition = function() {
        var k = this.ui;
        var h = k.attr("near");
        var e = k.attr("at");
        var d = $("#designGridCanvas");
        var m = 5;
        var g = d.offset();
        g.left += m;
        g.top += m;
        var f = d.width() - 2 * m;
        var n = d.height() - 2 * m;
        var j;
        var b = true;
        if (h) {
            j = $("#" + h).offset()
        } else {
            if (e) {
                j = $("#" + e).offset();
                j.left += 20;
                j.top += 20;
                b = false
            } else {
                j = {
                    left: g.left + f / 2,
                    top: g.top + n / 2
                }
            }
        }
        if (b) {
            var c = k.outerWidth();
            var l = k.outerHeight();
            if (j.left + c > g.left + f) {
                j.left = g.left + f - c
            }
            if (j.left < g.left) {
                j.left = g.left
            }
            if (j.top + l > g.top + n) {
                j.top = g.top + n - l
            }
            if (j.top < g.top) {
                j.top = g.top
            }
        }
        k.offset(j)
    };
    this.dragStart = function(b) {
        var d = this.ui;
        var c = d.find(".popupIcon");
        var e = false;
        c.each(function(j, m) {
            var p = $(m);
            var g = p.offset();
            var h = g.left;
            var f = h + p.outerWidth();
            var q = g.top;
            var n = q + p.outerHeight();
            var o = b.clientX + window.pageXOffset;
            var k = b.clientY + window.pageYOffset;
            if (h <= o && o <= f && q <= k && k <= n) {
                e = true;
                p.mousedown()
            }
        });
        this.moved = e
    };
    this.dragMove = function(c) {
        this.moved = true;
        var f = this.ui;
        var d = c.clientX - this.drag.lastX;
        var b = c.clientY - this.drag.lastY;
        var e = f.offset();
        e.left += d;
        e.top += b;
        f.offset(e)
    };
    this.dragEnd = function(b) {
        if (!this.moved) {
            this.setFocus()
        }
    };
    this.forget = function() {
        this.hideCB = null;
        this.hideCBObj = null;
        this.hideCBArgs = null;
        this.ui = null;
        this.titleBar = null;
        this.id = ""
    }
}
accumulateSolid = {
    lines: [],
    start: function() {
        this.lines = []
    },
    colourGridPos: function(b) {
        if (!this.lines[b.y]) {
            this.lines[b.y] = {
                min: b.x,
                max: b.x
            }
        } else {
            var a = this.lines[b.y];
            a.min = Math.min(b.x, a.min);
            a.max = Math.max(b.x, a.max)
        }
    },
};
solidDrawer = function(a) {
    this.mouseDown = function(b) {
        accumulateSolid.start();
        a.mouseDown(b)
    };
    this.mouseUp = function(b) {
        this.showShape(this.commitDrawer, b);
        designGrid.clearToolCtx()
    };
    this.mouseMove = function(b) {
        this.showShape(this.overlayDrawer, b)
    };
    this.overlayDrawer = {
        finishDrawing: function() {
            designGrid.drawGrid(designGrid.toolCtx)
        },
        drawLines: function(d) {
            var e = designGrid.deselWidth;
            var f = designGrid.deselSize;
            for (var g in d) {
                g = parseInt(g);
                var c = d[g];
                var b = 1 + c.max - c.min;
                designGrid.toolCtx.fillRect(designGrid.offsetX(g) + c.min * e, designGrid.offY + g * f, b * e, f)
            }
        },
    };
    this.commitDrawer = {
        finishDrawing: function() {},
        drawLines: function(d) {
            designGrid.startBatchColour();
            for (var e in d) {
                e = parseInt(e);
                var c = d[e];
                for (var b = c.min; b <= c.max; b++) {
                    if (designGrid.isClipValid(b, e)) {
                        designGrid.batchColourCoords(b, e)
                    }
                }
            }
            designGrid.endBatchColour()
        },
    };
    this.showShape = function(b, c) {
        designGrid.clearToolCtx();
        accumulateSolid.start();
        a.showShape(accumulateSolid, c);
        b.drawLines(accumulateSolid.lines);
        b.finishDrawing()
    }
};
drawingTools = {
    toolPen: {
        mouseDown: function(a) {
            drawingTools.toolLine.downPos = a;
            designGrid.colourMousePos(a)
        },
        mouseMove: function(a) {
            drawingTools.toolLine.showLine(designGrid, a);
            drawingTools.toolLine.downPos = a
        },
    },
    toolLine: {
        downPos: {
            x: 0,
            y: 0
        },
        mouseDown: function(a) {
            this.downPos = a;
            this.showLine(this, a)
        },
        mouseUp: function(a) {
            this.showLine(designGrid, a)
        },
        mouseMove: function(a) {
            this.showLine(this, a)
        },
        showLine: function(a, b) {
            designGrid.clearToolCtx();
            this.drawLine(a, b)
        },
        drawLine: function(b, f) {
            var j = f.x - this.downPos.x;
            var h = f.y - this.downPos.y;
            var g = Math.abs(h / designGrid.deselSize);
            var c = designGrid.offsetRows ? 2 : 1;
            var d = c * Math.abs(j / designGrid.deselWidth);
            g = Math.max(g, d);
            j /= g;
            h /= g;
            var a = {
                x: this.downPos.x,
                y: this.downPos.y
            };
            for (var e = 0; e <= g; e++) {
                b.colourMousePos(a);
                a.x += j;
                a.y += h
            }
            b.colourMousePos(f)
        },
        colourMousePos: function(b) {
            var a = designGrid.toGridPos(b);
            designGrid.drawColouredDesel(designGrid.toolCtx, a.x, a.y, designGrid.colour)
        },
    },
    toolRectOutline: {
        downPos: {
            x: 0,
            y: 0
        },
        downMousePos: {
            x: 0,
            y: 0
        },
        setDownPos: function(a) {
            this.downPos = designGrid.toGridPos(a);
            this.downMousePos = a
        },
        mouseDown: function(a) {
            this.setDownPos(a);
            this.showShape(this, a)
        },
        mouseUp: function(a) {
            this.showShape(designGrid, a)
        },
        mouseMove: function(a) {
            this.showShape(this, a)
        },
        showShape: function(c, g) {
            designGrid.clearToolCtx();
            var e = designGrid.toGridPos(g);
            var h = e.y < this.downPos.y ? -designGrid.deselSize : designGrid.deselSize;
            var a = clone(this.downPos);
            var d = clone(this.downMousePos);
            var f = designGrid.toGridPos({
                x: g.x,
                y: this.downMousePos.y
            });
            var j = a.x < f.x ? designGrid.deselWidth : -designGrid.deselWidth;
            while (a.x != f.x) {
                c.colourGridPos(a);
                d.x += j;
                a = designGrid.toGridPos(d)
            }
            d.x = g.x;
            a = designGrid.toGridPos(d);
            while (a.y != e.y) {
                c.colourGridPos(a);
                d.y += h;
                a = designGrid.toGridPos(d)
            }
            d.y = g.y;
            a = designGrid.toGridPos(d);
            var b = designGrid.toGridPos({
                x: this.downMousePos.x,
                y: g.y
            });
            j = a.x < b.x ? designGrid.deselWidth : -designGrid.deselWidth;
            while (a.x != b.x) {
                c.colourGridPos(a);
                d.x += j;
                a = designGrid.toGridPos(d)
            }
            d.x = this.downMousePos.x;
            a = designGrid.toGridPos(d);
            while (a.y != this.downPos.y) {
                c.colourGridPos(a);
                d.y -= h;
                a = designGrid.toGridPos(d)
            }
            c.colourGridPos(this.downPos)
        },
        colourGridPos: function(a) {
            designGrid.drawColouredDesel(designGrid.toolCtx, a.x, a.y, designGrid.colour)
        },
    },
    toolEllipseOutline: {
        downPos: {
            x: 0,
            y: 0
        },
        downMousePos: null,
        mouseDown: function(a) {
            this.downMousePos = a;
            this.downPos = designGrid.toGridPos(a);
            this.showShape(this, a)
        },
        mouseUp: function(a) {
            this.showShape(designGrid, a)
        },
        mouseMove: function(a) {
            this.showShape(this, a)
        },
        drawPoints: function(e, b, g, a, f) {
            var d = Math.round(g + f);
            var c = Math.round(g - f);
            e.colourGridPos({
                x: Math.round(b + a),
                y: d
            });
            e.colourGridPos({
                x: Math.round(b - a),
                y: d
            });
            e.colourGridPos({
                x: Math.round(b - a),
                y: c
            });
            e.colourGridPos({
                x: Math.round(b + a),
                y: c
            })
        },
        drawBetween: function(c, p, b, l, j, k, f, h, g, e, d, o) {
            if (designGrid.gridPossTouch({
                    x: c,
                    y: p
                }, {
                    x: l,
                    y: j
                })) {
                return
            }
            var n = e * Math.cos(o);
            var m = d * Math.sin(o);
            this.drawPoints(f, h, g, n, m);
            this.drawBetween(c, p, b, Math.round(h + n), Math.round(g + m), o, f, h, g, e, d, (b + o) / 2);
            this.drawBetween(Math.round(h + n), Math.round(g + m), o, l, j, k, f, h, g, e, d, (k + o) / 2)
        },
        showShape: function(a, b) {
            if (designGrid.offsetRows) {
                this.showShapeHex(a, b)
            } else {
                this.showShapeRect(a, b)
            }
        },
        showShapeRect: function(e, l) {
            designGrid.clearToolCtx();
            var g = designGrid.toGridPos(l);
            var d = Math.min(g.x, this.downPos.x);
            var k = Math.max(g.x, this.downPos.x);
            var c = Math.min(g.y, this.downPos.y);
            var j = Math.max(g.y, this.downPos.y);
            var h = (d + k) / 2;
            var f = (c + j) / 2;
            var b = k - h;
            var a = j - f;
            this.drawPoints(e, h, f, b, 0);
            this.drawPoints(e, h, f, 0, a);
            this.drawBetween(Math.round(h - b), Math.round(f), Math.PI, Math.round(h), Math.round(f - a), 3 * Math.PI / 2, e, h, f, b, a, 5 * Math.PI / 4)
        },
        addHexBetween: function(d, l, j, h, f, t, r, o) {
            var m = (t + r) / 2;
            var s = l + h * Math.cos(m);
            var n = j + f * Math.sin(m);
            var g = designGrid.toGridPos({
                x: s,
                y: n
            });
            var e = d[d.length - 1];
            var k = true;
            if (g.x == e.x && g.y == e.y) {
                if (o) {
                    return
                }
            } else {
                k = false
            }
            this.addHexBetween(d, l, j, h, f, t, m, o || k);
            e = d[d.length - 1];
            if (g.x != e.x || g.y != e.y) {
                d.push(g)
            }
            this.addHexBetween(d, l, j, h, f, m, r, o || k)
        },
        showShapeHex: function(s, l) {
            designGrid.clearToolCtx();
            var c = this.downMousePos;
            var a = l;
            var h = (c.x + a.x) / 2;
            var g = (c.y + a.y) / 2;
            var m = [];
            var k = h - c.x;
            var j = g - c.y;
            var q = designGrid.toGridPos({
                x: h + k,
                y: g
            });
            m.push(q);
            this.addHexBetween(m, h, g, k, j, 0, 2 * Math.PI, false);
            for (var r = 3; r < m.length; r++) {
                if (designGrid.gridPossTouch(m[r - 2], m[r]) && designGrid.gridPossTouch(m[r - 2], m[r - 3]) && designGrid.gridPossTouch(m[r - 1], m[r]) && designGrid.gridPossTouch(m[r - 1], m[r - 3])) {
                    var d = designGrid.toCanvasCentre(m[r - 1]);
                    var f = (h - d.x) / k;
                    var o = (g - d.y) / j;
                    var u = Math.abs(1 - (f * f + o * o));
                    var b = designGrid.toCanvasCentre(m[r - 2]);
                    var e = (h - b.x) / k;
                    var n = (g - b.y) / j;
                    var t = Math.abs(1 - (e * e + n * n));
                    if (t < u) {
                        m.splice(r - 1, 1)
                    } else {
                        m.splice(r - 2, 1)
                    }
                    r--
                }
            }
            for (var r = 2; r < m.length; r++) {
                if (designGrid.gridPossTouch(m[r - 2], m[r])) {
                    m.splice(r - 1, 1);
                    r--
                }
            }
            for (var r in m) {
                s.colourGridPos(m[r])
            }
        },
        colourGridPos: function(a) {
            designGrid.drawColouredDesel(designGrid.toolCtx, a.x, a.y, designGrid.colour)
        },
    },
    toolFill: {
        dirsRect: [{
            x: 1,
            y: 0
        }, {
            x: 0,
            y: 1
        }, {
            x: -1,
            y: 0
        }, {
            x: 0,
            y: -1
        }],
        dirsHexOdd: [{
            x: 1,
            y: 0
        }, {
            x: 0,
            y: 1
        }, {
            x: 1,
            y: 1
        }, {
            x: -1,
            y: 0
        }, {
            x: 0,
            y: -1
        }, {
            x: 1,
            y: -1
        }],
        dirsHexEven: [{
            x: 1,
            y: 0
        }, {
            x: -1,
            y: 1
        }, {
            x: 0,
            y: 1
        }, {
            x: -1,
            y: 0
        }, {
            x: -1,
            y: -1
        }, {
            x: 0,
            y: -1
        }],
        dirsEO: [],
        queue: null,
        animTimer: null,
        target: null,
        mouseDown: function(b) {
            if (designGrid.offsetRows) {
                this.dirsEO[0] = this.dirsHexEven;
                this.dirsEO[1] = this.dirsHexOdd
            } else {
                this.dirsEO[0] = this.dirsRect;
                this.dirsEO[1] = this.dirsRect
            }
            clearInterval(this.animTimer);
            var a = designGrid.toGridPos(b);
            this.target = designGrid.indexAt(a.x, a.y);
            designGrid.colourGridPos(a);
            this.queue = new Array;
            this.queue.push(a.x);
            this.queue.push(a.y);
            designGrid.startBatchColour();
            this.animTimer = setInterval(function() {
                drawingTools.toolFill.animStep()
            }, 16)
        },
        finished: function() {
            designGrid.endBatchColour();
            clearInterval(this.animTimer)
        },
        animStep: function() {
            if (designGrid.paletteIndex == this.target) {
                this.finished();
                return
            }
            var k = this.queue.length / 2;
            var e = 0;
            while (k-- > 0 && this.queue.length) {
                var b = this.queue[e++];
                var j = this.queue[e++];
                if (Math.random() < 0.5) {
                    this.queue.push(b);
                    this.queue.push(j);
                    k++;
                    continue
                }
                var f = this.dirsEO[j & 1];
                for (var g in f) {
                    var a = b + f[g].x;
                    var h = j + f[g].y;
                    if (!designGrid.isGridValid(a, h)) {
                        continue
                    }
                    if (this.canMove(b, j, a, h)) {
                        designGrid.batchColourCoords(a, h);
                        this.queue.push(a);
                        this.queue.push(h)
                    }
                }
            }
            this.queue.splice(0, e);
            if (!this.queue.length) {
                this.finished()
            }
        },
        canMove: function(e, d, b, a) {
            if (designGrid.indexAt(b, a) != this.target) {
                return false
            }
            if (designGrid.offsetRows) {
                return true
            }
            if (designGrid.grid.backstitch(b, a) & (designGrid.BS_FORWARD | designGrid.BS_BACK)) {
                return false
            }
            var c = designGrid.grid.backstitch(Math.max(e, b), Math.max(d, a));
            if (e == b && (c & designGrid.BS_TOP)) {
                return false
            }
            if (d == a && (c & designGrid.BS_LEFT)) {
                return false
            }
            return true
        }
    },
    toolText: {
        popup: new PgPopup("#textToolPopup"),
        activate: function() {
            if ($("#textToolFontSelect option").size() == 0) {
                $("#textToolText").val("");
                $.each(TextUtil.fontList(), function(a, b) {
                    $("#textToolFontSelect").append($("<option>", {
                        value: b,
                        style: "font-family:'" + b + "';"
                    }).text(b))
                });
                $("#textToolOk").click(function() {
                    drawingTools.toolText.popup.hide();
                    drawingTools.toolText.setText()
                });
                $("#textToolText").change(function() {
                    drawingTools.toolText.updateSample()
                });
                $("#textToolText").keyup(function() {
                    drawingTools.toolText.updateSample()
                });
                $("#textToolFontSelect").change(function() {
                    drawingTools.toolText.updateSample()
                });
                $("#textToolFontSize").change(function() {
                    drawingTools.toolText.updateSample()
                });
                $("#textToolFontSize").keyup(function() {
                    drawingTools.toolText.updateSample()
                });
                $("#textToolBold").change(function() {
                    drawingTools.toolText.updateSample()
                });
                $("#textToolItalic").change(function() {
                    drawingTools.toolText.updateSample()
                })
            }
            this.popup.show();
            if (!this.weightSlider) {
                this.weightSlider = new PgSlider("textToolWeightThumb", function(a, b) {
                    drawingTools.toolText.updateWeight(a)
                })
            }
            this.showWeight();
            designGrid.clearToolCtx();
            this.textImg = null;
            this.tooWide = $("#textToolTooWide");
            this.updateSample()
        },
        deactivate: function() {
            this.popup.hide();
            designGrid.clearToolCtx();
            this.textImg = null
        },
        updateSample: function() {
            var f = this.getImg();
            this.tooWide.toggleClass("hideMe", TextUtil.textWidth <= designGrid.width());
            var c = document.getElementById("textToolSample");
            var r = c.getContext("2d");
            r.clearRect(0, 0, c.width, c.height);
            var q = designGrid.deselSize;
            if (q >= 10) {
                q = 5
            }
            var g = designGrid.applyDeselRatio(q);
            var d = Math.ceil(c.width / g);
            var p = Math.ceil(c.height / q);
            var o = Math.max(0, Math.floor((f.width - d) / 2));
            var m = Math.max(0, Math.floor((f.height - p) / 2));
            var j = Math.min(f.width, 1 + Math.ceil((f.width + d) / 2));
            var h = Math.min(f.height, 1 + Math.ceil((f.height + p) / 2));
            var b = Math.floor(c.width / 2 - g * f.width / 2);
            var a = Math.floor(c.height / 2 - q * f.height / 2);
            c
            for (var l = m; l < h; l++) {
                var k = (designGrid.offsetRows && (l & 1)) ? Math.round(g / 2) : 0;
                for (var n = o; n < j; n++) {
                    var e = (l * f.width + n) * 4;
                    r.fillStyle = f.data[e + 3] == 255 ? "#000000" : "#ffffff";
                    r.fillRect(b + n * g + k, a + l * q, g, q)
                }
            }
        },
        textImg: null,
        setText: function() {
            this.textImg = this.getImg()
        },
        getImg: function() {
            return TextUtil.textImage($("#textToolText").val(), $("#textToolFontSelect").val(), $("#textToolFontSize").val(), $("#textToolBold").prop("checked"), $("#textToolItalic").prop("checked"))
        },
        moveEventsWhileUp: 1,
        mouseUp: function(b) {
            if (!this.textImg) {
                return
            }
            var a = designGrid.toGridPos(b);
            this.drawText(designGrid, a.x, a.y);
            this.textImg = null;
            $("#textToolText").val("");
            toolBox.selectTool("toolSelect")
        },
        mouseMove: function(b) {
            if (!this.textImg) {
                return
            }
            designGrid.clearToolCtx();
            designGrid.toolCtx.fillStyle = designGrid.colour;
            var a = designGrid.toGridPos(b);
            this.drawText(this, a.x, a.y)
        },
        drawText: function(d, c, b) {
            c -= Math.floor(this.textImg.width / 2);
            b -= Math.floor(this.textImg.height / 2);
            for (var f = 0; f < this.textImg.height; f++) {
                var e = 0;
                if (designGrid.offsetRows) {
                    e = (f & 1) * (b & 1)
                }
                for (var a = 0; a < this.textImg.width; a++) {
                    if (this.textImg.data[((f * this.textImg.width) + a) * 4 + 3] == 255) {
                        if (designGrid.isGridValid(c + a + e, b + f)) {
                            d.colourGridCoords(c + a + e, b + f)
                        }
                    }
                }
            }
        },
        colourGridCoords: function(a, b) {
            designGrid.drawFixedDesel(designGrid.toolCtx, a, b)
        },
        updateWeight: function(a) {
            TextUtil.weight = 25 + 205 * (1 - a);
            this.updateSample()
        },
        showWeight: function() {
            var a = 1 - (TextUtil.weight - 25) / 205;
            this.weightSlider.setPos(a, 0, "noNotify")
        },
    },
    init: function() {
        this.toolRectSolid = new solidDrawer(this.toolRectOutline);
        this.toolEllipseSolid = new solidDrawer(this.toolEllipseOutline)
    },
    toolBackstitch: {
        lastPos: {
            x: -10,
            y: -10
        },
        downPos: {
            x: -10,
            y: -10
        },
        mouseDown: function(a) {
            this.lastPos = {
                x: -10,
                y: -10
            };
            this.downPos = this.roundPos(a)
        },
        mouseMove: function(f) {
            f = this.roundPos(f);
            var c = f.x - this.downPos.x;
            var a = f.y - this.downPos.y;
            var b = Math.round(Math.max(Math.abs(c), Math.abs(a)));
            c /= b;
            a /= b;
            var e = this.downPos;
            for (var d = 0; d < b; d++) {
                e.x += c;
                e.y += a;
                this.backstitchTo(e)
            }
            this.downPos = f
        },
        roundPos: function(a) {
            return {
                x: Math.round(a.x),
                y: Math.round(a.y)
            }
        },
        backstitchTo: function(g) {
            var e = designGrid.deselWidth / 2;
            var f = designGrid.deselSize / 2;
            var d = designGrid.toGridPos({
                x: g.x + e,
                y: g.y + f
            });
            var b = designGrid.toCanvasPos(d);
            var c = Math.abs((g.x - b.x) / e);
            var a = Math.abs((g.y - b.y) / f);
            if (c + a > 1) {
                return
            }
            this.addStitch(d);
            this.lastPos = d
        },
        addStitch: function(c) {
            var b = c.x - this.lastPos.x;
            var a = c.y - this.lastPos.y;
            switch (a) {
                case -1:
                    switch (b) {
                        case -1:
                            designGrid.addBackstitch(c.x, c.y, designGrid.BS_BACK);
                            break;
                        case 0:
                            designGrid.addBackstitch(this.lastPos.x, c.y, designGrid.BS_LEFT);
                            break;
                        case 1:
                            designGrid.addBackstitch(this.lastPos.x, c.y, designGrid.BS_FORWARD);
                            break;
                        default:
                            break
                    }
                    break;
                case 0:
                    switch (b) {
                        case -1:
                            designGrid.addBackstitch(c.x, this.lastPos.y, designGrid.BS_TOP);
                            break;
                        case 1:
                            designGrid.addBackstitch(this.lastPos.x, this.lastPos.y, designGrid.BS_TOP);
                            break;
                        default:
                            break
                    }
                    break;
                case 1:
                    switch (b) {
                        case -1:
                            designGrid.addBackstitch(c.x, this.lastPos.y, designGrid.BS_FORWARD);
                            break;
                        case 0:
                            designGrid.addBackstitch(this.lastPos.x, this.lastPos.y, designGrid.BS_LEFT);
                            break;
                        case 1:
                            designGrid.addBackstitch(this.lastPos.x, this.lastPos.y, designGrid.BS_BACK);
                            break;
                        default:
                            break
                    }
                    break;
                default:
                    break
            }
        },
    },
    toolErase: {
        rad: 0,
        done: null,
        mouseDown: function(a) {
            this.done = new Array(designGrid.width() * designGrid.height());
            clearInterval(this.timer);
            this.rad = 0;
            this.timer = setInterval(function() {
                drawingTools.toolErase.incRad()
            }, 500);
            drawingTools.toolLine.downPos = a;
            this.colourMousePos(a)
        },
        mouseMove: function(a) {
            clearInterval(this.timer);
            drawingTools.toolLine.showLine(this, a);
            drawingTools.toolLine.downPos = a
        },
        mouseUp: function(a) {
            clearInterval(this.timer);
            this.done = null
        },
        incRad: function() {
            this.rad++;
            this.colourMousePos(drawingTools.toolLine.downPos)
        },
        colourMousePos: function(d) {
            var j = designGrid.width();
            var a = (this.rad + 0.5) * (this.rad + 0.5);
            var b = designGrid.toGridPos(d);
            for (var e = -this.rad; e <= this.rad; e++) {
                for (var g = -this.rad; g <= this.rad; g++) {
                    if (g * g + e * e > a) {
                        continue
                    }
                    var h = b.x + g;
                    var f = b.y + e;
                    if (!designGrid.isClipValid(h, f)) {
                        continue
                    }
                    var c = h + f * j;
                    if (this.done[c]) {
                        continue
                    }
                    this.done[c] = 1;
                    designGrid.erase(h, f)
                }
            }
        },
    },
    toolPickColour: {
        mouseDown: function(a) {
            this.pickColour(a)
        },
        mouseMove: function(a) {
            this.pickColour(a)
        },
        pickColour: function(d) {
            var c = designGrid.toGridPos(d);
            if (designGrid.isGridValid(c)) {
                var a = designGrid.indexAt(c.x, c.y);
                var b = cdoPalette.currentIndex;
                cdoPalette.setCurrentIndex(a);
                cdoPalette.drawBlob(b);
                cdoPalette.drawBlob(a)
            }
        },
    },
};
drawingTools.init();
pgToolSelect = {
    selA: {
        x: 0,
        y: 0
    },
    selB: {
        x: 0,
        y: 0
    },
    selected: false,
    dragStart: {
        x: 0,
        y: 0
    },
    imgCopy: null,
    gridCopy: null,
    activate: function(a) {
        if (!this.initialised) {
            DesIO.addLoadNotify(function(b) {
                b.clearSelection()
            }, pgToolSelect);
            this.initialised = true
        }
        this.clearSelection()
    },
    deactivate: function(a) {
        this.clearSelection()
    },
    mouseDown: function(b) {
        drawingTools.toolRectOutline.setDownPos(b);
        var a = designGrid.toGridPos(b);
        this.dragStart = a;
        if (this.selected) {
            if (this.gridPosInSelection(a)) {
                this.startDrag(b);
                return
            }
            this.selected = false
        }
        this.normaliseSelection(b);
        this.showSelection()
    },
    gridPosInSelection: function(b) {
        var a = accumulateSolid.lines[b.y];
        if (!a) {
            return false
        }
        return a.min <= b.x && b.x <= a.max
    },
    mouseUp: function(b) {
        designGrid.toolCtx.clearRect(0, 0, designGrid.toolCanvas.width, designGrid.toolCanvas.height);
        var a = designGrid.toGridPos(b);
        if (this.selected && a != this.dragStart) {
            designGrid.toolCtx.clearRect(0, 0, designGrid.toolCanvas.width, designGrid.toolCanvas.height);
            this.placeSelection(a);
            designGrid.draw();
            if (this.dragOverlapsSource(a)) {
                this.selected = false
            } else {
                this.showSelection()
            }
            AutoSave.save()
        } else {
            this.selected = true;
            this.normaliseSelection(b);
            this.copyImage();
            this.copySelection();
            this.showSelection()
        }
    },
    mouseMove: function(b) {
        var a = designGrid.toGridPos(b);
        if (this.selected) {
            this.showDrag(a)
        } else {
            this.normaliseSelection(b);
            this.showSelection()
        }
    },
    copyImage: function() {
        var f = designGrid.deselWidth;
        var q = designGrid.deselSize;
        var j = accumulateSolid.lines[this.selA.y];
        var a = designGrid.offsetX(this.selA.y) + j.min * f;
        var s = designGrid.offY + this.selA.y * q;
        var n = designGrid.offsetX(this.selA.y) + (j.max + 1) * f;
        var m = designGrid.offY + (this.selB.y + 1) * q;
        if (this.selB.y != this.selA.y) {
            var g = accumulateSolid.lines[this.selA.y + 1];
            a = Math.min(a, designGrid.offsetX(this.selA.y + 1) + g.min * f);
            n = Math.max(n, designGrid.offsetX(this.selA.y + 1) + (g.max + 1) * f)
        }
        var p = n - a;
        var l = m - s;
        var e = cdoPalette.colours[0].colour;
        var b = null;
        if (cdoPalette.hasBackgroundColour) {
            b = designGrid.gridCtx.getImageData(0, 0, designGrid.gridCanvas.width, designGrid.gridCanvas.height);
            cdoPalette.colours[0].colour = "rgba(255,255,255,0.5)";
            designGrid.gridCtx.clearRect(0, 0, designGrid.gridCanvas.width, designGrid.gridCanvas.height);
            designGrid.drawDesels(designGrid.gridCtx);
            designGrid.drawGrid(designGrid.gridCtx)
        }
        this.imgCopy = designGrid.gridCtx.getImageData(a, s, p, l);
        cdoPalette.colours[0].colour = e;
        if (cdoPalette.hasBackgroundColour) {
            designGrid.gridCtx.putImageData(b, 0, 0)
        }
        this.imgX = a;
        this.imgY = s;
        this.imgCanvas = document.createElement("canvas");
        this.imgCanvas.width = p;
        this.imgCanvas.height = l;
        var d = this.imgCanvas.getContext("2d");
        d.clearRect(0, 0, p, l);
        d.putImageData(this.imgCopy, 0, 0);
        for (var o = this.selA.y; o <= this.selB.y; o++) {
            var r = accumulateSolid.lines[o];
            var c = designGrid.offsetX(o) + r.min * f;
            var k = designGrid.offsetX(o) + (r.max + 1) * f;
            d.clearRect(0, (o - this.selA.y) * q, c - a, q);
            d.clearRect(k - a, (o - this.selA.y) * q, n - k, q)
        }
    },
    copySelection: function() {
        var c = this.selB.x - this.selA.x + 1;
        var d = this.selB.y - this.selA.y + 1;
        this.gridCopy = new DeselGrid(c, d, 0);
        for (var f = 0; f < d; f++) {
            var b = accumulateSolid.lines[f + this.selA.y];
            c = 1 + b.max - b.min;
            for (var a = 0; a < c; a++) {
                var e = clone(designGrid.grid.grid.at(b.min + a, this.selA.y + f));
                if (a == c - 1 && b.min + c < designGrid.width()) {
                    e.b |= (designGrid.grid.grid.at(b.min + c, this.selA.y + f).b & designGrid.BS_LEFT) << 4
                }
                if (f == d - 1 && this.selA.y + d < designGrid.height()) {
                    e.b |= (designGrid.grid.grid.at(b.min + a, this.selA.y + d).b & designGrid.BS_TOP) << 4
                }
                this.gridCopy.grid.setAt(a, f, e)
            }
        }
    },
    placeSelection: function(k, j) {
        var l = this.selB.x - this.selA.x + 1;
        var g = this.selB.y - this.selA.y + 1;
        var b = this.selA.y;
        var d = accumulateSolid.lines[this.selA.y].min;
        var c = designGrid.toCanvasCentre({
            x: d,
            y: b
        });
        var p = designGrid.toCanvasCentre(this.dragStart);
        var e = designGrid.toCanvasCentre(k);
        var f = e.x + c.x - p.x;
        var a = e.y + c.y - p.y;
        var m = designGrid.toGridPos({
            x: f,
            y: a
        });
        designGrid.copyToGrid(this.gridCopy, 0, 0, l, g, m.x, m.y, accumulateSolid.lines, this.selA.y, this.r1Offset, j)
    },
    BELOW: 0,
    BELOW_LEFT: -1,
    BELOW_RIGHT: 1,
    r1Offset: 0,
    numLines: 0,
    normaliseSelection: function(h) {
        accumulateSolid.start();
        drawingTools.toolRectOutline.showShape(accumulateSolid, h);
        this.selA = {
            x: 1000000,
            y: 1000000
        };
        this.selB = {
            x: -1000000,
            y: -1000000
        };
        this.numLines = 0;
        var c = designGrid.width();
        for (var b in accumulateSolid.lines) {
            if (b < 0 || designGrid.height() <= b) {
                accumulateSolid.lines.slice(b, 1);
                continue
            }
            var a = accumulateSolid.lines[b];
            if (a.min < 0) {
                a.min = 0
            }
            if (a.min >= c) {
                a.min = c - 1
            }
            if (a.max < 0) {
                a.max = 0
            }
            if (a.max >= c) {
                a.max = c - 1
            }
            this.selA.x = Math.min(this.selA.x, a.min);
            this.selA.y = Math.min(this.selA.y, b);
            this.selB.x = Math.max(this.selB.x, a.max);
            this.selB.y = Math.max(this.selB.y, b);
            this.numLines++
        }
        this.r1Offset = this.BELOW;
        if (designGrid.offsetRows) {
            if (this.numLines > 1) {
                var g = this.selA.y;
                var f = accumulateSolid.lines[g].min;
                var d = accumulateSolid.lines[g + 1].min;
                var e = designGrid.deselWidth;
                f = designGrid.offsetX(g) + f * e;
                d = designGrid.offsetX(g + 1) + d * e;
                this.r1Offset = d < f ? this.BELOW_LEFT : this.BELOW_RIGHT
            }
        }
    },
    zoomChanged: function() {
        if (this.selected) {
            this.copyImage();
            this.showSelection()
        }
    },
    offsetChanged: function() {
        if (this.selected) {
            this.showSelection()
        }
    },
    showSelection: function() {
        var a = designGrid.toolCtx;
        a.clearRect(0, 0, designGrid.toolCanvas.width, designGrid.toolCanvas.height);
        this.showSelectionOffset(a, 0, 0)
    },
    showSelectionOffset: function(b, k, q) {
        b.lineWidth = 1;
        var e = designGrid.deselWidth;
        var l = designGrid.deselSize;
        if (designGrid.offsetRows) {
            var d = -1000000;
            var r = 0,
                t = 0;
            for (var f = this.selA.y; f <= this.selB.y; f++) {
                var h = accumulateSolid.lines[f];
                var c = designGrid.offsetX(f);
                var m = c + h.min * e + k;
                var p = c + (h.max + 1) * e + k;
                var s = designGrid.offY + f * l - 0.5 + q;
                var a = s + l;
                if (d != -1000000) {
                    b.patternedLine(r, s, m, s, 4, ["#000000", "#ffffff"]);
                    b.patternedLine(t, s, p, s, 4, ["#000000", "#ffffff"])
                }
                r = m;
                t = p;
                b.patternedLine(r, s, r, a, 4, ["#000000", "#ffffff"]);
                b.patternedLine(t, s, t, a, 4, ["#000000", "#ffffff"]);
                d = f;
                if (f == this.selA.y) {
                    b.patternedLine(r, s, t, s, 4, ["#000000", "#ffffff"])
                }
                if (f == this.selB.y) {
                    b.patternedLine(r, a, t, a, 4, ["#000000", "#ffffff"])
                }
            }
        } else {
            var j = designGrid.offsetX(this.selA.y) + this.selA.x * e - 0.5 + k;
            var g = designGrid.offY + this.selA.y * l - 0.5 + q;
            var o = designGrid.offsetX(this.selB.y) + (this.selB.x + 1) * e - 0.5 + k;
            var n = designGrid.offY + (this.selB.y + 1) * l - 0.5 + q;
            b.patternedLine(j, g, j, n, 4, ["#000000", "#ffffff"]);
            b.patternedLine(j, n, o, n, 4, ["#000000", "#ffffff"]);
            b.patternedLine(o, n, o, g, 4, ["#000000", "#ffffff"]);
            b.patternedLine(o, g, j, g, 4, ["#000000", "#ffffff"])
        }
    },
    showDrag: function(h) {
        var c = designGrid.toolCtx;
        c.clearRect(0, 0, designGrid.toolCanvas.width, designGrid.toolCanvas.height);
        var e = designGrid.toCanvasPos(this.dragStart);
        var b = designGrid.toCanvasPos(h);
        var d = b.x - e.x;
        var f = b.y - e.y;
        var a = this.imgX + d;
        var g = this.imgY + f;
        c.drawImage(this.imgCanvas, a, g);
        this.showSelectionOffset(c, d, f)
    },
    compareCopies: function(l) {
        var g = this.selB.x - this.selA.x + 1;
        var j = this.selB.y - this.selA.y + 1;
        for (var k = 0; k < j; k++) {
            var f = accumulateSolid.lines[k + this.selA.y];
            g = 1 + f.max - f.min;
            for (var d = 0; d < g; d++) {
                var e = this.gridCopy.grid.at(d, k);
                var c = l.grid.at(d, k);
                if (!e.equals(c)) {
                    return false
                }
            }
        }
        return true
    },
    dragOverlapsSource: function(b) {
        var a = this.gridCopy;
        this.copySelection();
        return !this.compareCopies(a)
    },
    clearSelection: function() {
        this.selected = false;
        designGrid.toolCtx.clearRect(0, 0, designGrid.toolCanvas.width, designGrid.toolCanvas.height)
    },
    startDrag: function(a) {},
};

function ZoomTools(a) {
    this.toolScroll = {
        lastX: 0,
        lastY: 0,
        activate: function() {
            if (a.scrollActivated) {
                a.scrollActivated()
            }
        },
        mouseDown: function(b) {
            this.lastX = b.x;
            this.lastY = b.y
        },
        mouseUp: function(b) {
            this.scrollTo(b)
        },
        mouseMove: function(b) {
            this.scrollTo(b)
        },
        scrollTo: function(d) {
            var c = d.x - this.lastX;
            var b = d.y - this.lastY;
            actual = a.scrollBy(c, b);
            this.lastX += actual.dx;
            this.lastY += actual.dy
        },
    };
    this.toolZoomIn = {
        click: function() {
            a.zoomIn()
        }
    };
    this.toolZoomOut = {
        click: function() {
            a.zoomOut()
        }
    }
}

function PgSlider(c, d, b, a) {
    this.thumb = $("#" + c);
    this.parent = this.thumb.parent();
    this.rangeX = 0;
    this.rangeY = 0;
    this.calcRanges = function() {
        if (this.rangeX || this.rangeY) {
            return
        }
        this.rangeX = this.parent.width() - this.thumb.outerWidth();
        this.rangeY = this.parent.height() - this.thumb.outerHeight()
    };
    this.calcRanges();
    this.notify = function() {
        this.calcRanges();
        var g = this.thumb.offset();
        var h = this.parent.offset();
        var f = this.rangeX == 0 ? 0 : (g.left - h.left) / this.rangeX;
        var e = this.rangeY == 0 ? 0 : (g.top - h.top) / this.rangeY;
        d(f, e, b)
    };
    this.lastX = 0;
    this.lastY = 0;
    this.mousedown = false;
    this.disabled = function() {
        return this.thumb.parents().hasClass("disabledAction")
    };
    this.dragStart = function(e) {
        if (this.disabled()) {
            return
        }
        if (!this.mousedown) {
            this.setPosPix(e.clientX + window.pageXOffset - this.thumb.width() / 2, e.clientY + window.pageYOffset - this.thumb.height() / 2)
        }
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.mousedown = true
    };
    this.rangeDragStart = function(e) {
        if (this.disabled()) {
            return
        }
        this.dragStart(e)
    };
    this.rangeDragMove = function(e) {
        if (this.disabled()) {
            return
        }
        if (!this.mousedown) {
            return
        }
        this.setPosPix(e.clientX + window.pageXOffset - this.thumb.width() / 2, e.clientY + window.pageYOffset - this.thumb.height() / 2);
        this.lastX = e.clientX;
        this.lastY = e.clientY
    };
    this.dragMove = function(e) {
        if (this.disabled()) {
            return
        }
        if (!this.mousedown) {
            return
        }
        this.moveThumb(e)
    };
    this.dragEnd = function(e) {
        this.mousedown = false;
        if (this.disabled()) {
            return
        }
        if (a) {
            a(b)
        }
    };
    this.thumbDrag = new Draggable(this.thumb, this);
    this.rangeDrag = new Draggable(this.parent, {
        obj: this,
        dragStart: function(e) {
            this.obj.rangeDragStart(e)
        },
        dragMove: function(e) {
            this.obj.rangeDragMove(e)
        },
        dragEnd: function(e) {
            this.obj.dragEnd(e)
        },
    });
    this.moveThumb = function(g) {
        var h = g.clientX - this.lastX;
        var f = g.clientY - this.lastY;
        var j = this.thumb.offset();
        this.setPosPix(j.left + h, j.top + f);
        var e = this.thumb.offset();
        this.lastX += e.left - j.left;
        this.lastY += e.top - j.top
    };
    this.relX = 0;
    this.relY = 0;
    this.limitPix = function(f, e) {
        this.calcRanges();
        f = Math.min(Math.max(0, f), this.rangeX);
        e = Math.min(Math.max(0, e), this.rangeY);
        return {
            left: f,
            top: e
        }
    };
    this.limiter = this;
    this.setPosPix = function(k, g, e) {
        var j = this.thumb.offset();
        var f = j.left;
        var h = j.top;
        var m = this.parent.offset();
        var l = this.limitPix.call(this.limiter, k - m.left, g - m.top);
        k = l.left + m.left;
        g = l.top + m.top;
        this.relX = k - m.left;
        this.relY = g - m.top;
        if (f != k || h != g) {
            this.thumb.offset({
                left: k,
                top: g
            });
            if (!e) {
                this.notify()
            }
        }
    };
    this.setPos = function(g, f, e) {
        this.calcRanges();
        var h = this.parent.offset();
        h.left += this.rangeX * g;
        h.top += this.rangeY * f;
        this.setPosPix(h.left, h.top, e)
    };
    this.parent.offset({
        slider: this
    }, function(e) {
        e.data.slider.reposition()
    });
    this.reposition = function() {
        var e = this.parent.offset();
        this.setPosPix(e.left + this.relX, e.top + this.relY, "noNotify")
    }
}
pgMagicUtils = {
    partsH: 1,
    chunksH: [],
    partsV: 1,
    chunksV: [],
    done: null,
    width: 0,
    height: 0,
    sample: null,
    error: null,
    dither: 0.1,
    ditherSlider: null,
    errDirX: 1,
    errDirY: 1,
    definition: 1.2,
    definitionSlider: null,
    brushSize: 0.05,
    brushSlider: null,
    setupSlider: function() {
        if (!this.ditherSlider) {
            this.ditherSlider = new PgSlider("ditherThumb", function(a, b) {
                pgMagicUtils.ditherSliderChange(a)
            })
        }
        this.setDither(this.dither);
        if (!this.definitionSlider) {
            this.definitionSlider = new PgSlider("definitionThumb", function(a, b) {
                pgMagicUtils.definitionSliderChange(a)
            })
        }
        this.setDefinition(this.definition);
        if (!this.brushSlider) {
            this.brushSlider = new PgSlider("brushThumb", function(a, b) {
                pgMagicUtils.brushSliderChange(a)
            })
        }
        this.setBrushSize(this.brushSize)
    },
    ditherSliderChange: function(a) {
        this.dither = a;
        AutoSave.save("quiet")
    },
    setDither: function(a) {
        this.dither = a;
        if (this.ditherSlider) {
            this.ditherSlider.setPos(this.dither, 0, "noNotify")
        }
    },
    definitionSliderChange: function(a) {
        this.definition = 2 - (a * 2);
        AutoSave.save("quiet")
    },
    setDefinition: function(a) {
        this.definition = a;
        if (this.definitionSlider) {
            this.definitionSlider.setPos((2 - this.definition) / 2, 0, "noNotify")
        }
    },
    brushSliderChange: function(a) {
        this.brushSize = a * 0.1;
        AutoSave.save("quiet")
    },
    setBrushSize: function(a) {
        this.brushSize = a;
        if (this.brushSlider) {
            this.brushSlider.setPos(this.brushSize * 10, 0, "noNotify")
        }
    },
    prepChunks: function() {
        this.errDirX = 1;
        this.errDirY = 1;
        var d = designGrid.deselSize;
        this.partsV = Math.round(Math.min(Math.max(1, d / 3), 4));
        for (var e = 0; e <= this.partsV; e++) {
            this.chunksV[e] = Math.round(d * e / this.partsV)
        }
        var a = designGrid.deselWidth;
        this.partsH = Math.round(Math.min(Math.max(1, a / 3), 4));
        for (var e = 0; e <= this.partsH; e++) {
            this.chunksH[e] = Math.round(a * e / this.partsH)
        }
        this.width = designGrid.width();
        this.height = designGrid.height();
        var c = this.width * this.height;
        this.done = new Array(c);
        this.error = new Array(c);
        for (var b = 0; b < c; b++) {
            this.error[b] = {
                r: 0,
                g: 0,
                b: 0
            }
        }
    },
    autoColourGridPos: function(d) {
        if (!designGrid.isGridValid(d.x, d.y)) {
            return
        }
        var a = d.x + d.y * this.width;
        if (this.done[a]) {
            return
        }
        this.done[a] = true;
        var c = 0;
        if (this.partsV == 1 && this.partsH == 1) {
            c = this.singleColourSample(d)
        } else {
            c = this.multiColourSample(d)
        }
        if (c < 0) {
            return
        }
        if (this.sample) {
            this.calcError(c, d)
        }
        var b = designGrid.paletteIndex;
        designGrid.paletteIndex = c;
        designGrid.colourGridPos(d);
        designGrid.paletteIndex = b
    },
    singleColourSample: function(e) {
        var b = designGrid.offsetX(e.y) + e.x * designGrid.deselWidth;
        var a = designGrid.offY + e.y * designGrid.deselSize;
        var f = b + designGrid.deselWidth;
        var d = a + designGrid.deselSize;
        var c = pgToolColourPicker.sampleTracing(b, a, f, d, pgTracing.imgData);
        this.sample = c;
        if (!c) {
            return -1
        }
        this.sample = c = this.addError(c, e);
        return cdoPalette.closestColourIndex(c)
    },
    colours: [],
    multiColourSample: function(d) {
        var c = designGrid.deselWidth;
        var f = designGrid.deselSize;
        var b = designGrid.offsetX(d.y) + d.x * c;
        var j = designGrid.offY + d.y * f;
        this.colours.length = 0;
        for (var g = 0; g < this.partsV; g++) {
            for (var h = 0; h < this.partsH; h++) {
                var a = pgToolColourPicker.sampleTracing(b + this.chunksH[h], j + this.chunksV[g], b + this.chunksH[h + 1], j + this.chunksV[g + 1], pgTracing.imgData);
                if (!a) {
                    continue
                }
                a = this.addError(a, d);
                this.colours.push(a)
            }
        }
        var e = pgToolColourPicker.sampleTracing(b, j, b + c, j + f, pgTracing.imgData);
        this.sample = e;
        if (this.colours.length == 0 && !e) {
            return -1
        }
        this.sample = e = this.addError(e, d);
        return cdoPalette.closestColourIndexMulti(this.colours, e)
    },
    calcError: function(b, f) {
        var c = cdoPalette.colours[b].cdoColour;
        var e = this.sample.r - c.r;
        var d = this.sample.g - c.g;
        var a = this.sample.b - c.b;
        this.changeError(7, f.x + this.errDirX, f.y, e, d, a);
        this.changeError(3, f.x - this.errDirX, f.y + this.errDirY, e, d, a);
        this.changeError(5, f.x, f.y + this.errDirY, e, d, a);
        this.changeError(1, f.x + this.errDirX, f.y + this.errDirY, e, d, a)
    },
    changeError: function(d, a, h, g, e, b) {
        if (a < 0 || a >= this.width || h < 0 || h >= this.height) {
            return
        }
        var c = this.error[a + h * this.width];
        d = this.dither * d / 16;
        c.r += g * d;
        c.g += e * d;
        c.b += b * d
    },
    addError: function(f, e) {
        var d = this.error[e.x + e.y * this.width];
        var c = Math.round(Math.min(Math.max(0, f.r + d.r), 255));
        var b = Math.round(Math.min(Math.max(0, f.g + d.g), 255));
        var a = Math.round(Math.min(Math.max(0, f.b + d.b), 255));
        return new CdoColour(c, b, a)
    },
};
pgToolMagicPen = {
    imgData: null,
    lastDesX: -1,
    lastDesY: -1,
    activate: function(a) {
        designGrid.toolCtx.clearRect(0, 0, designGrid.toolCanvas.width, designGrid.toolCanvas.height)
    },
    deactivate: function(a) {},
    mouseDown: function(a) {
        pgMagicUtils.prepChunks();
        this.autoColourPoint(a);
        drawingTools.toolLine.downPos = a
    },
    mouseMove: function(a) {
        drawingTools.toolLine.showLine(this, a);
        drawingTools.toolLine.downPos = a
    },
    mouseUp: function(a) {
        this.lastDesX = -1
    },
    colourMousePos: function(b) {
        var a = designGrid.toGridPos(b);
        if (a.x == this.lastDesX && a.y == this.lastDesY) {
            return
        }
        this.lastDesX = a.x;
        this.lastDesY = a.y;
        pgMagicUtils.autoColourGridPos(a)
    },
    autoColourPoint: function(b) {
        var a = pgToolColourPicker.sampleTracing(b.x - 1, b.y - 1, b.x + 1, b.y + 1, pgTracing.imgData);
        if (!a) {
            return
        }
        cdoPalette.selectClosestColour(a);
        designGrid.colourMousePos(b)
    },
};
pgToolMagicBrush = {
    imgData: null,
    activate: function(a) {
        designGrid.toolCtx.clearRect(0, 0, designGrid.toolCanvas.width, designGrid.toolCanvas.height)
    },
    deactivate: function(a) {},
    mouseDown: function(a) {
        pgMagicUtils.prepChunks();
        this.colourMousePos(a);
        drawingTools.toolLine.downPos = a
    },
    mouseMove: function(a) {
        pgMagicUtils.errDirX = (a.x < drawingTools.toolLine.downPos.x) ? -1 : 1;
        pgMagicUtils.errDirY = (a.y < drawingTools.toolLine.downPos.y) ? -1 : 1;
        drawingTools.toolLine.showLine(this, a);
        drawingTools.toolLine.downPos = a
    },
    mouseUp: function(a) {
        this.lastDesX = -1
    },
    colourMousePos: function(e) {
        var b = Math.max(1, designGrid.width() * pgMagicUtils.brushSize, designGrid.height() * pgMagicUtils.brushSize);
        b = Math.round(b * 2) / 2;
        var c = b * b + 1;
        for (var d = -b; d <= b; d++) {
            for (var a = -b; a <= b; a++) {
                if (a * a + d * d > c) {
                    continue
                }
                this.autoColourPoint({
                    x: e.x + a * designGrid.deselWidth,
                    y: e.y + d * designGrid.deselSize
                })
            }
        }
    },
    autoColourPoint: function(b) {
        var a = designGrid.toGridPos(b);
        pgMagicUtils.autoColourGridPos(a)
    },
};
pgToolMagicFill = {
    click: function() {
        pgMagicUtils.prepChunks();
        autoTracing.startRepaint()
    },
};
autoTracing = {
    colourPool: [],
    samples: [],
    colours: [],
    fullPalette: false,
    timer: null,
    lastState: "",
    state: "",
    progressPopup: new PgPopup("#autoTracingProgressPopup"),
    progressMessage: null,
    start: function() {
        this.colourPool = [];
        this.samples = [];
        this.colours = [];
        this.fullPalette = false;
        AutoSave.immediate();
        cdoPalette.reset();
        designGrid.reset("zoomOut");
        this.startState("getColourPool")
    },
    startRepaint: function() {
        AutoSave.immediate();
        this.startState("paint")
    },
    startState: function(a) {
        this.restartElapsed();
        clearTimeout(this.timer);
        this.timer = setInterval(this.timeout, 50);
        this.lastState = "";
        this.state = a;
        this.progressMessage = $("#autoTracingProgressMessage");
        this.progressMessage.text("starting");
        this.progressPopup.show()
    },
    stop: function() {
        clearTimeout(autoTracing.timer);
        this.progressPopup.hide();
        this.state = ""
    },
    stageStart: 0,
    timeout: function() {
        var b = autoTracing[autoTracing.state];
        if (!b) {
            clearTimeout(autoTracing.timer);
            return
        }
        var c = autoTracing.state != autoTracing.lastState;
        if (c) {
            autoTracing.restartElapsed()
        }
        autoTracing.lastState = autoTracing.state;
        try {
            b.call(autoTracing, c)
        } catch (a) {
            this.stop()
        }
    },
    restartElapsed: function() {
        this.stageStart = (new Date()).valueOf()
    },
    elapsed: function() {
        var a = (new Date()).valueOf();
        return a - this.stageStart
    },
    getColourPool: function(q) {
        var f = designGrid.imageCanvas.width;
        var v = designGrid.imageCanvas.height;
        var k = colourSource.numColours();
        if (q) {
            this.posCount = 0;
            this.posIdx = 0;
            this.progressMessage.text("finding color ");
            if (k < 1000) {
                this.fullPalette = true;
                for (var z = 0; z < k; z++) {
                    var m = colourSource.idByIndex(z);
                    g = new CdoColour(m);
                    this.colourPool.push({
                        id: m,
                        colour: g
                    })
                }
            }
            return
        } else {
            if (this.elapsed() > 5000) {
                this.posCount += 10000
            } else {
                this.progressMessage.text(this.progressMessage.text() + ".")
            }
        }
        var s = designGrid.deselWidth / 2;
        var p = Math.round(s / 2);
        s = Math.max(2, Math.round(s)) - p;
        var o = designGrid.deselSize / 2;
        var l = Math.round(o / 2);
        o = Math.max(2, Math.round(o)) - l;
        var a = 0;
        for (; this.posCount < 10000; this.posCount++) {
            var e = this.posIdx % f;
            var d = Math.round(this.posIdx / f) % v;
            this.posIdx += 1087;
            if (a > 300000) {
                return
            }
            var g = pgToolColourPicker.sampleTracing(e - p, d - l, e + s, d + o, pgTracing.imgData);
            if (!g) {
                continue
            }
            idx = this.samples.length;
            var j = 2.5;
            for (var r in this.samples) {
                a++;
                var b = this.samples[r];
                var n = g.dist(b.colour);
                if (n < j) {
                    j = n;
                    idx = r
                }
            }
            if (this.samples.length == idx) {
                this.samples.push({
                    count: 1,
                    id: g.toString(),
                    colour: g
                })
            } else {
                this.samples[idx].count++
            }
        }
        if (!this.fullPalette) {
            for (var r in this.samples) {
                var u = this.samples[r];
                this.colourPool.push({
                    id: u.id,
                    colour: u.colour
                })
            }
        }
        for (var r in this.samples) {
            this.samples[r].count = Math.log(1 + this.samples[r].count)
        }
        this.state = "chooseColours"
    },
    chooseColours: function(b) {
        if (b) {
            this.progressMessage.text("choosing color");
            this.discomfort = [];
            this.lastImp = [];
            for (var a in this.samples) {
                this.discomfort[a] = 1000000000
            }
        } else {
            this.progressMessage.text(this.progressMessage.text() + ".");
            if (this.addBestColours()) {
                this.state = "improveColours"
            }
        }
    },
    addBestColours: function() {
        for (var b in this.colourPool) {
            this.lastImp[b] = 1000000000000000000
        }
        var c = 0;
        while (c < 16 && this.colours.length < cdoPalette.numColours) {
            var a = this.findBestPoolColour();
            if (!a) {
                break
            }
            this.colours.push(a);
            this.updateDiscomfort(a);
            c++
        }
        return c < 16
    },
    improveColours: function(k) {
        if (k) {
            var e = this.sumDiscomfort();
            this.bestCols = new TrackMin(this.colours, e);
            this.changeCount = 0;
            this.progressMessage.text("improving choice");
            this.impTry = 10;
            return
        } else {
            if (this.elapsed() > 20000) {
                this.state = "assignColours";
                return
            }
        }
        var d = this.colours.length;
        var h = [];
        for (var f = 0; f < d / 4; f++) {
            var a = Math.floor(Math.random() * this.colours.length);
            var c = this.colours[a];
            this.colours.splice(a, 1);
            h.push(c)
        }
        for (var f in h) {
            var c = h[f];
            this.updateDiscomfortRemoval(c)
        }
        while (!this.addBestColours()) {}
        var e = this.sumDiscomfort();
        var g = this.bestCols.update(this.colours, e);
        this.changeCount++;
        var b = this.progressMessage.text();
        var j = b[b.length - 1];
        if (j == "." || j == ":") {
            b = b.substr(0, b.length - 1)
        }
        if (g) {
            this.impTry = 10;
            b += "+"
        } else {
            this.impTry--;
            if (j == ".") {
                b += ":"
            } else {
                b += "."
            }
        }
        this.progressMessage.text(b);
        if (this.impTry <= 0) {
            this.colours = this.bestCols.id;
            this.state = "assignColours"
        }
    },
    sumDiscomfort: function() {
        var b = 0;
        for (var a in this.discomfort) {
            b += this.discomfort[a]
        }
        return b
    },
    findBestPoolColour: function() {
        var c = new TrackMax(null, 0);
        for (var b in this.colourPool) {
            var d = this.colourPool[b];
            if (this.lastImp[b] < c.val) {
                continue
            }
            var a = this.discomfortImprovement(d);
            this.lastImp[b] = a;
            c.update(d, a)
        }
        return c.id
    },
    discomfortImprovement: function(f) {
        var e = 0;
        for (var d in this.samples) {
            var b = this.samples[d];
            var a = this.calcDiscomfort(b, f);
            var c = Math.max(0, this.discomfort[d] - a);
            e += c
        }
        return e
    },
    updateDiscomfort: function(b) {
        for (var a in this.samples) {
            this.discomfort[a] = Math.min(this.discomfort[a], this.calcDiscomfort(this.samples[a], b))
        }
    },
    updateDiscomfortRemoval: function(b) {
        for (var a in this.samples) {
            if (this.discomfort[a] == this.calcDiscomfort(this.samples[a], b)) {
                this.discomfort[a] = this.findDiscomfort(this.samples[a])
            }
        }
    },
    findDiscomfort: function(c) {
        var b = 1000000000;
        for (var a in this.colours) {
            b = Math.min(b, this.calcDiscomfort(c, this.colours[a]))
        }
        return b
    },
    calcDiscomfort: function(a, c) {
        var b = a.colour.dist(c.colour);
        return b * a.count
    },
    assignColours: function(g) {
        for (var c = 1; c < this.colours.length; c++) {
            var f = new TrackMin(c, 1000000);
            for (var b = c; b < this.colours.length; b++) {
                var e = this.colours[c - 1].colour.dist(this.colours[b].colour);
                f.update(b, e)
            }
            var d = new TrackMin(0, 1000000);
            for (var b = 0; b < c - 1; b++) {
                var e = this.colours[c].colour.dist(this.colours[b].colour) + this.colours[c].colour.dist(this.colours[b + 1].colour);
                d.update(b, e)
            }
            if (d.val < f.val) {
                var a = this.colours[c];
                this.colours.splice(c, 1);
                this.colours.splice(d.id + 1, 0, a)
            } else {
                var a = this.colours[c];
                this.colours[c] = this.colours[f.id];
                this.colours[f.id] = a
            }
        }
        for (var c = 0; c < cdoPalette.numColours && c < this.colours.length; c++) {
            cdoPalette.colours[c].setId(this.colours[c].id)
        }
        cdoPalette.setCurrentIndex(1);
        cdoPalette.setCurrentIndex(0);
        cdoPalette.draw();
        designGrid.draw();
        this.state = "paint"
    },
    paint: function(d) {
        if (d) {
            designGrid.clearToolCtx();
            this.x = 0;
            this.y = 0;
            this.drawStep = 0;
            this.progressMessage.text("drawing");
            pgMagicUtils.prepChunks();
            return
        } else {
            this.progressMessage.text(this.progressMessage.text() + ".")
        }
        var a = designGrid.width();
        var b = designGrid.height();
        var c = 0;
        for (; this.y < b; this.y++) {
            for (; this.x < a; this.x++) {
                if (c++ > 2000) {
                    if ((this.drawStep % 10) == 0) {
                        this.progressMessage.text("drawing")
                    }
                    this.drawStep++;
                    return
                }
                pgMagicUtils.autoColourGridPos({
                    x: this.x,
                    y: this.y
                })
            }
            this.x = 0
        }
        this.state = "stop";
        designGrid.draw()
    },
};
pgLibrary = {
    browser: null,
    gotOffset: false,
    init: function() {
        this.browser = new PgPopup("#libraryBrowsePopup");
        initParentLibrarySelect();
        this.getLibrary()
    },
    startBrowse: function() {
        if (!this.browser) {
            this.init()
        } else {
            if (this.gotOffset != designGrid.offsetRows) {
                this.getLibrary()
            }
        }
        this.browser.show()
    },
    getLibrary: function() {
        var a = $("#libraryBrowseFrame");
        a.contents().find("html").html("<head></head><body>Opening...</body>");
        this.gotOffset = designGrid.offsetRows;
        a.attr("src", "/pattern-library/?offset=" + this.gotOffset.toString())
    },
    addToLibrary: function() {
        AutoSave.immediate();
        threadLength.measure();
        var a = DesIO.getState(AppData.name, ["TR"]);
        $("#addLibraryDataField").attr("value", a);
        $("#addLibraryForm").submit()
    },
    openPattern: function(a) {
        new PgLibraryItem(a)
    },
    libItemLoaded: function(a) {
        AutoSave.pause();
        colourSource.init();
        paletteInit();
        designGridInit();
        pgTracing.init();
        toolBox.init();
        threadLength.init();
        var d = $("#titleText").text();
        if (!d) {
            d = "Pattern"
        }
        var c = $(window.frameElement).parent().find(".libItemTitle");
        var f = c.html();
        f = f.replace("Opening...", d);
        c.html(f);
        initChildLibrarySelect();
        var b = $("#patternData").text();
        if (a[0] == "L") {
            var e = Number(a.substr(1));
            b = parent.pgLibrary.localData[e];
            parent.pgLibrary.localData[e] = undefined
        }
        DesIO.loadFromStr(AppData.name, b, true);
        if (designGrid.offsetRows && (designGrid.height() & 1)) {
            designGrid.setHeight(designGrid.height() + 1)
        }
        designGrid.minDeselSize = Math.min(designGrid.minDeselSize, 4);
        designGrid.updateZoomButtons();
        designGrid.zoomObserverCB()
    },
    localData: [],
    localFileData: function(b) {
        var a = "L" + this.localData.length;
        this.localData.push(b);
        new PgLibraryItem(a)
    },
};

function PgLibraryItem(a) {
    this.pgId = a;
    var e = $(".libraryItemPopupProto");
    this.popupElement = e.clone();
    this.popupElement.removeClass("libraryItemPopupProto").addClass("libraryItemPopup");
    this.popupElement.insertAfter(e);
    this.popup = new PgPopup(this.popupElement);
    this.popup.hideCBObj = this;
    this.popup.hideCB = function() {
        this.popup.forget();
        this.popup = null;
        this.popupElement.remove();
        this.iframe = null;
        this.popupElement = null
    };
    this.popup.show();
    this.iframe = this.popupElement.find("iframe");
    var c = document.URL;
    var b = c.lastIndexOf("/") + 1;
    var d = "/cdo-apps/pattern-grid/pglib.php" + c.substr(b);
    d += (b == c.length) ? "?" : "&";
    d += "item=" + a;
    this.iframe.attr("src", d)
}
pgLibraryToolSelect = clone(pgToolSelect);

function initChildLibrarySelect() {
    pgLibraryToolSelect.copySelection = function() {
        pgToolSelect.copySelection.call(this);
        parent.$(parent.window).trigger("pgLibraryToolSelect.copySelection", [pgLibraryToolSelect, cdoPalette, accumulateSolid.lines, $("#selectionInfo")])
    };
    pgLibraryToolSelect.startDrag = function(a) {
        pgLibraryToolSelect.inDrag = true;
        parent.$(parent.window).trigger("pgLibraryToolSelect.startDrag", [pgLibraryToolSelect, cdoPalette, accumulateSolid.lines, designGrid.toGridPos(a), pgLibraryToolSelect.mainDgPos(a)])
    };
    pgLibraryToolSelect.mainDgPos = function(f) {
        var c = $(parent.window.designGrid.gridCanvas);
        var a = c.offset();
        var e = $(designGrid.gridCanvas).offset();
        var b = $(window.frameElement);
        var d = b.offset();
        return {
            x: f.x + e.left + d.left - a.left,
            y: f.y + e.top + d.top - a.top
        }
    };
    pgLibraryToolSelect.mouseDown = function(b) {
        var a = this;
        window.parent.MouseUpCapture.start(function(d) {
            var c = designGrid.getMousePos(d);
            a.extMouseUp(c, d)
        });
        window.parent.MouseMoveCapture.start(function(d) {
            var c = designGrid.getMousePos(d);
            a.extMouseMove(c, d)
        });
        window.parent.TouchEndCapture.start(function(d) {
            var c = designGrid.getTouchPos(d);
            a.extMouseUp(c, d)
        });
        window.parent.TouchCancelCapture.start(function(d) {
            var c = designGrid.getTouchPos(d, false);
            a.extMouseUp(c, d)
        });
        window.parent.TouchMoveCapture.start(function(d) {
            var c = designGrid.getTouchPos(d, true);
            a.extMouseMove(c, d)
        });
        pgToolSelect.mouseDown.call(this, b)
    };
    pgLibraryToolSelect.mouseMove = function(a) {
        if (pgLibraryToolSelect.inDrag) {
            parent.$(parent.window).trigger("pgLibraryToolSelect.mouseMove", [pgLibraryToolSelect.mainDgPos(a)])
        } else {
            pgToolSelect.mouseMove.call(this, a)
        }
    };
    pgLibraryToolSelect.extMouseMove = function(a) {
        designGrid.mouseMove(this.adjustExtPos(a))
    };
    pgLibraryToolSelect.mouseUp = function(a) {
        window.parent.MouseUpCapture.end();
        window.parent.MouseMoveCapture.end();
        window.parent.TouchEndCapture.end();
        window.parent.TouchMoveCapture.end();
        window.parent.TouchCancelCapture.end();
        if (pgLibraryToolSelect.inDrag) {
            pgLibraryToolSelect.inDrag = false;
            parent.$(parent.window).trigger("pgLibraryToolSelect.mouseUp", [pgLibraryToolSelect.mainDgPos(a)])
        } else {
            pgToolSelect.mouseUp.call(this, a)
        }
    };
    pgLibraryToolSelect.extMouseUp = function(a) {
        designGrid.mouseUp(this.adjustExtPos(a))
    };
    pgLibraryToolSelect.adjustExtPos = function(d) {
        var a = window.frameElement;
        var c = $(a).offset();
        d.x += window.parent.pageXOffset - c.left;
        d.y += window.parent.pageYOffset - c.top;
        var b = $(designGrid.gridCanvas).offset();
        d.x -= b.left;
        d.y -= b.top;
        return d
    };
    designGrid.zoomObserverCB = function() {
        var e = designGrid.deselWidth * designGrid.grid.width + designGrid.offXExtra;
        var b = designGrid.deselSize * designGrid.grid.height;
        e = Math.min(e, 600);
        b = Math.min(b, 600);
        var d = $(window.frameElement);
        var c = d.parent();
        var a = Math.min(6, c.width() - d.width());
        $("#dgCanvases canvas").attr("height", b);
        $("#dgCanvases canvas").attr("width", e);
        $("#dgCanvases").height(b);
        d.attr("width", e);
        d.attr("height", b + $("#bottomStuff").height() + 20);
        c.css("min-width", e + a);
        designGrid.limitOffset();
        designGrid.setClips();
        designGrid.draw();
        pgLibraryToolSelect.zoomChanged()
    }
}

function initParentLibrarySelect() {
    pgLibraryToolSelect.copySelection = function(d, c, b, a) {
        if (d) {
            pgLibraryToolSelect.item = d;
            pgLibraryToolSelect.srcPalette = c;
            pgLibraryToolSelect.lines = b;
            pgLibraryToolSelect.infoLine = a
        }
        if (pgLibraryToolSelect.item) {
            pgLibraryToolSelect.convertSelection()
        }
    };
    $(window).bind("pgLibraryToolSelect.copySelection", function(e, d, c, b, a) {
        pgLibraryToolSelect.copySelection(d, c, b, a)
    });
    pgLibraryToolSelect.startDrag = function(e, b, a, d, c) {
        pgLibraryToolSelect.item = e;
        pgLibraryToolSelect.srcPalette = b;
        pgLibraryToolSelect.lines = a;
        pgLibraryToolSelect.restoreTool = toolBox.currentToolId();
        toolBox.selectTool("pgLibraryToolSelect");
        pgLibraryToolSelect.selected = true;
        pgLibraryToolSelect.dragStart = clone(d);
        accumulateSolid.lines = clone(a);
        pgLibraryToolSelect.selA = clone(e.selA);
        pgLibraryToolSelect.selB = clone(e.selB);
        pgLibraryToolSelect.r1Offset = e.r1Offset;
        pgLibraryToolSelect.numLines = e.numLines;
        pgLibraryToolSelect.convertSelection();
        pgLibraryToolSelect.createSprite();
        $("body").append(pgLibraryToolSelect.imgCanvas);
        $(pgLibraryToolSelect.imgCanvas).css("z-index", "1000");
        pgLibraryToolSelect.showDrag(designGrid.toGridPos(c))
    };
    $(window).bind("pgLibraryToolSelect.startDrag", function(f, e, b, a, d, c) {
        pgLibraryToolSelect.startDrag(e, b, a, d, c)
    });
    pgLibraryToolSelect.convertSelection = function() {
        this.selA = clone(this.item.selA);
        this.selB = clone(this.item.selB);
        this.gridCopy = clone(this.item.gridCopy);
        var q = [];
        var e = [];
        var g = 0;
        var p = this.selB.x - this.selA.x + 1;
        var A = this.selB.y - this.selA.y + 1;
        for (var l = 0; l < A; l++) {
            var o = this.lines[l + this.selA.y];
            p = 1 + o.max - o.min;
            for (var m = 0; m < p; m++) {
                var B = this.gridCopy.grid.at(m, l);
                if (B.i == 0 && this.srcPalette.hasBackgroundColour) {
                    continue
                }
                if (q[B.i] != 1) {
                    g++;
                    e.push(B.i)
                }
                q[B.i] = 1
            }
        }
        this.modColours = [];
        var f = {
            0: 0
        };
        var c = 0;
        if (g <= 1) {
            this.useColours = cdoPalette.colours;
            if (g == 1) {
                c = 1;
                f[e[0]] = cdoPalette.currentIndex
            }
        } else {
            this.useColours = clone(cdoPalette.colours);
            var k = new CdoColour("#ffffff");
            var r = [];
            for (var z = 0; z < cdoPalette.numColours; z++) {
                var d = this.useColours[z];
                if (d.usage == 0) {
                    var u = k.dist(d.cdoColour);
                    if (u < 2) {
                        r.push(z)
                    }
                }
            }
            for (var z = 0; z < e.length; z++) {
                var t = e[z];
                var d = this.srcPalette.colours[t];
                var s = -1;
                for (var v = 0; v < cdoPalette.numColours; v++) {
                    if (this.useColours[v].id == d.id) {
                        c = Math.max(2, c);
                        s = v
                    }
                }
                if (s == -1) {
                    if (r.length) {
                        s = r[0];
                        r.splice(0, 1);
                        this.useColours[s].setId(d.id);
                        this.modColours.push(s);
                        c = Math.max(3, c)
                    }
                }
                if (s == -1) {
                    var b = new TrackMin(0, 1000000);
                    for (var v = 0; v < cdoPalette.numColours; v++) {
                        var u = d.cdoColour.dist(this.useColours[v].cdoColour);
                        b.update(v, u)
                    }
                    s = b.id;
                    c = 4
                }
                f[t] = s
            }
        }
        for (var l = 0; l < A; l++) {
            var o = this.lines[l + this.selA.y];
            p = 1 + o.max - o.min;
            for (var m = 0; m < p; m++) {
                var B = this.gridCopy.grid.at(m, l);
                B.i = f[B.i]
            }
        }
        var n = ["Only backstitch will be copied.", "#004000", "This pattern will be copied using your current color.", "#000040", "This pattern will be copied using colors you already have.", "#004000", "Copy will add new colors to your palette from this pattern", "#404000", "Copy may add colors, but will try to use similar colors already in your palette", "#400000"];
        this.infoLine.text(n[c * 2]);
        this.infoLine.css("color", n[c * 2 + 1]);
        this.copyType = c
    };
    pgLibraryToolSelect.createSprite = function() {
        this.imgCanvas = document.createElement("canvas");
        this.imgCanvas.width = 600;
        this.imgCanvas.height = 600;
        var b = this.imgCanvas.getContext("2d");
        b.clearRect(0, 0, 600, 600);
        var q = designGrid.toGridPos({
            x: designGrid.deselWidth - 1,
            y: designGrid.deselSize - 1
        });
        if (designGrid.offsetRows && (this.selA.y & 1) != (q.y & 1)) {
            q.y++
        }
        if (designGrid.offsetRows && this.r1Offset == this.BELOW_LEFT) {
            q.x++
        }
        var c = designGrid.toCanvasPos(q);
        var n = 0,
            j = 0;
        if (this.r1Offset == pgToolSelect.BELOW_LEFT && !(q.y & 1)) {
            n = 0;
            j = -1
        } else {
            if (this.r1Offset == pgToolSelect.BELOW_RIGHT && (q.y & 1)) {
                n = 1;
                j = 0
            }
        }
        var m = this.selB.x - this.selA.x + 1;
        var f = this.selB.y - this.selA.y + 1;
        for (var g = 0; g < f; g++) {
            var p = this.lines[g + this.selA.y];
            m = 1 + p.max - p.min;
            var d = g + q.y;
            for (var l = 0; l < m; l++) {
                var k = this.gridCopy.grid.at(l, g);
                var e = l + q.x + ((d & 1) ? j : n);
                if (!(k.i == 0 && this.srcPalette.hasBackgroundColour)) {
                    b.fillStyle = this.useColours[k.i].colour;
                    designGrid.drawDeselRect(b, e, d)
                } else {
                    b.fillStyle = "rgba(255,255,255,0.5)";
                    designGrid.drawDeselRect(b, e, d)
                }
                if (designGrid.showBackstitch()) {
                    var o = this.gridCopy.backstitch(l, g);
                    if (o) {
                        designGrid.setupBackstitchContext(b);
                        designGrid.drawBackstitchLines(b, e, d, o & 15);
                        if (o & 16) {
                            designGrid.drawBackstitchLines(b, e + 1, d, (o & 16) >> 4)
                        }
                        if (o & 32) {
                            designGrid.drawBackstitchLines(b, e, d + 1, (o & 32) >> 4)
                        }
                    }
                }
            }
        }
        this.imgOffX = (this.selA.x - this.dragStart.x) * designGrid.deselWidth - c.x;
        this.imgOffY = (this.selA.y - this.dragStart.y) * designGrid.deselSize - c.y;
        if (designGrid.offsetRows) {
            if (!(this.selA.y & 1)) {
                if (this.dragStart.y & 1) {
                    this.imgOffX += designGrid.offXExtra
                } else {
                    this.imgOffX += designGrid.deselWidth
                }
                if (this.r1Offset == pgToolSelect.BELOW_RIGHT) {
                    this.imgOffX -= designGrid.deselWidth
                }
            }
            if (!(this.dragStart.y & 1) && (this.selA.y & 1)) {
                this.imgOffX += designGrid.offXExtra
            }
        }
    };
    $(window).bind("pgLibraryToolSelect.mouseMove", function(a, b) {
        pgLibraryToolSelect.mouseMove(b)
    });
    pgLibraryToolSelect.mouseUp = function(a) {
        pgToolSelect.mouseUp.call(this, a);
        toolBox.selectTool(pgLibraryToolSelect.restoreTool)
    };
    $(window).bind("pgLibraryToolSelect.mouseUp", function(a, b) {
        pgLibraryToolSelect.mouseUp(b)
    });
    pgLibraryToolSelect.placeSelection = function(b) {
        $(pgLibraryToolSelect.imgCanvas).remove();
        pgLibraryToolSelect.imgCanvas = null;
        for (i in this.modColours) {
            var a = this.modColours[i];
            cdoPalette.colours[a].setId(this.useColours[a].id)
        }
        pgToolSelect.placeSelection.call(this, b, this.srcPalette.hasBackgroundColour)
    };
    pgLibraryToolSelect.showDrag = function(d) {
        d = designGrid.toCanvasPos(d);
        var b = $("#designGrid").offset();
        var a = d.x + b.left + this.imgOffX;
        var c = d.y + b.top + this.imgOffY;
        $(pgLibraryToolSelect.imgCanvas).offset({
            left: a,
            top: c
        })
    };
    pgLibraryToolSelect.dragOverlapsSource = function(a) {
        return false
    }
}
pgLibraryToolRotateCW = {
    click: function() {
        var c = $("#dgCanvases canvas");
        var a = c.attr("width");
        var b = c.attr("height");
        c.attr("height", a);
        c.attr("width", b);
        designGrid.rotateCW();
        if (designGrid.offsetRows) {
            designGrid.rotateCW();
            c.attr("height", b);
            c.attr("width", a);
            designGrid.resetZoom()
        }
        designGrid.minDeselSize = Math.min(designGrid.minDeselSize, 4);
        designGrid.updateZoomButtons();
        pgLibraryToolSelect.clearSelection();
        designGrid.zoomObserverCB()
    }
};
var threadLength = {
    maxColours: cdoPalette.maxColours,
    lengths: new Array(this.maxColours),
    bsLength: 0,
    init: function() {
        DesIO.register("TL", function(a) {
            threadLength.fromString(a)
        }, function() {
            return threadLength.toString()
        });
        this.reset()
    },
    fromString: function(a) {},
    toString: function() {
        var g = cdoPalette.numColours;
        var d = new Array(3 + g);
        var b = 0;
        var a = 1;
        d[b++] = B64Coder.encodeNumber(a, 12);
        d[b++] = B64Coder.encodeNumber(g, 12);
        for (var f = 0; f < g; f++) {
            d[b++] = B64Coder.encodeNumber(this.lengths[f], 30)
        }
        d[b++] = B64Coder.encodeNumber(this.bsLength, 30);
        var e = d.join("");
        return e
    },
    reset: function() {
        for (var a = 0; a < this.maxColours; a++) {
            this.lengths[a] = 0
        }
        this.bsLength = 0
    },
    dirs: [{
        x: 1,
        y: 0
    }, {
        x: -1,
        y: 0
    }, {
        x: 0,
        y: -1
    }, {
        x: 0,
        y: 1
    }, {
        x: 1,
        y: 1
    }, {
        x: -1,
        y: 1
    }, {
        x: 1,
        y: -1
    }, {
        x: -1,
        y: -1
    }],
    measure: function() {
        this.reset();
        var g = designGrid.width();
        var q = designGrid.height();
        var n = 100;
        var c = 64;
        var b = new Array2D(g, q, 0);
        var a = cdoPalette.hasBackgroundColour ? designGrid.bgIndex : -100;
        for (var e = 0; e < q; e++) {
            for (var f = 0; f < g; f++) {
                if (b.at(f, e) != 0) {
                    continue
                }
                var j = designGrid.indexAt(f, e);
                if (j == a) {
                    continue
                }
                var p = n + c;
                var o = new Array();
                o.push(f);
                o.push(e);
                b.setAt(f, e, 1);
                while (o.length > 0) {
                    var l = o.shift();
                    var k = o.shift();
                    for (var r = 0; r < 8; r++) {
                        var t = l + this.dirs[r].x;
                        if (t < 0 || t >= g) {
                            continue
                        }
                        var s = k + this.dirs[r].y;
                        if (s < 0 || s >= q) {
                            continue
                        }
                        if (b.at(t, s) != 0) {
                            continue
                        }
                        if (designGrid.indexAt(t, s) != j) {
                            continue
                        }
                        p += c;
                        o.push(t);
                        o.push(s);
                        b.setAt(t, s, 1)
                    }
                }
                this.lengths[j] += p
            }
        }
        var m = 36;
        var v = 50;
        for (var e = 0; e < q; e++) {
            for (var f = 0; f < g; f++) {
                var u = designGrid.grid.backstitch(f, e);
                if (u & designGrid.BS_LEFT) {
                    this.bsLength += m
                }
                if (u & designGrid.BS_TOP) {
                    this.bsLength += m
                }
                if (u & designGrid.BS_FORWARD) {
                    this.bsLength += v
                }
                if (u & designGrid.BS_BACK) {
                    this.bsLength += v
                }
            }
        }
    },
};
