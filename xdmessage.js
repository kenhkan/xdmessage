;
(function(){
  /*********************************
   Helper Messages
  *********************************/
  function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.search);

    if (results === null) {
      return null;
    } else {
      return decodeURIComponent(results[1].replace(/\+/g, " "));
    }
  }

  function toParam(paramsObject) {
    var params=[];
    for(var key in paramsObject) {
      if (paramsObject[key]) {
        params.push(key + "=" + encodeURIComponent(paramsObject[key]))
      }
    }
    return params.join('&');
  }

  var ie = (function(){
    var undef,
        v = 3,
        div = document.createElement('div'),
        all = div.getElementsByTagName('i');

    while (
        div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->',
        all[0]
    );

    return v > 4 ? v : undef;
  }());

  // popups mobile browsers don't work properly with a given width and height
  // need a better way to do this
  function isMobileBrowser() {
   if( navigator.userAgent.match(/Android/i)
     || navigator.userAgent.match(/webOS/i)
     || navigator.userAgent.match(/iPhone/i)
     || navigator.userAgent.match(/iPad/i)
     || navigator.userAgent.match(/iPod/i)
     || navigator.userAgent.match(/BlackBerry/i)
     || navigator.userAgent.match(/Windows Phone/i)
   ){
      return true;
    }
   else {
      return false;
    }
  }

  /*********************************
   XDPost
  *********************************/
  var XDMessage = function(url, options) {
    if (typeof url === 'object') {
      options = url;
      url = null;
    }

    this.options        = options || {};
    this.events         = {};
    this.callbacks      = {};
    this.options.width  = this.options.width  || 720;
    this.options.height = this.options.height || 500;

    this.windowHostURL = getParameterByName('opener');
    this.token         = getParameterByName('XDMessage_token');
    this.isChildWindow = !url;

    if (this.options.popup && ie < 10) {
      this.options.popup = false;
      this.log('Popups not supported in IE < 10');
    }

    if (!this.isChildWindow) {
      this.frameURL     = url;
      this.frameHostURL = this.frameURL.match(/\S+\/\/([^\/]+)\//)[0].slice(0,-1);
    } else if (!this.windowHostURL) {
      throw 'opener parameter required';
    }
  };

  XDMessage.prototype.open = function() {
    var self = this;
    this._startListening();

    if (this.frameURL) {
      var opener = document.location.protocol + "//" + document.location.host;
      this.token = ("" + Math.random()).replace('0.','');
      var url    = this.frameURL + (this.frameURL.indexOf('?') === -1 ? '?' : '&') + toParam({ opener: opener, XDMessage_token: this.token });

      if (this.options.popup) {
        var width          = this.options.width;
        var height         = this.options.height;
        var left           = parseInt((screen.availWidth/2) - (width/2));
        var top            = parseInt((screen.availHeight/2) - (height/2));
        var windowFeatures;

        if (isMobileBrowser()) {
          windowFeatures = "status,resizable,scrollbars=1";
        } else {
          windowFeatures = "width=" + width + ",height=" + height + ",status,resizable,scrollbars=1,left=" + left + ",top=" + top + "screenX=" + left + ",screenY=" + top;
        }

        this.popup = window.open(url, "XDMessage_popup", windowFeatures);
      } else {
        var iframe = document.createElement('iframe');
        iframe.setAttribute('frameborder', '0');
        iframe.src = url;
        iframe.style.overflow='auto';
        iframe.onload = this._frameReady;

        if (this.options.target) {
          this.options.target.appendChild(iframe);
        } else {
          document.body.appendChild(iframe);
        }

        this.iframe = iframe;
      }
    } else {
      this.invoke('_ready', function() {
        self._ready();
      });
      this.on('_close', function(){
        if (self.options.popup) {
          window.close();
        }
      });
    }
    this.on('_ready', function(data, callback) {
      callback();
      self._ready();
    });
  };

  XDMessage.prototype.close = function() {
    if (this.iframe) {
      this.iframe.parentNode.removeChild(this.iframe);
    } else {
      this.popup.close();
    }
    delete(this.events);
    delete(this.callbacks);
    this._stopListening();
  };

  XDMessage.prototype.on = function(event, callback) {
    if (typeof event === 'string' && typeof callback === 'function') {
      this.events[event] = callback;
    }
  };

  XDMessage.prototype.send = function(data, callback, meta) {
    if (typeof callback === 'object') {
      meta = callback;
      callback = null;
    }

    var __xd_post_meta = meta || {};
    __xd_post_meta.token = this.token;

    if (callback) {
      var random = "" + Math.random();
      this.callbacks[random] = callback;
      __xd_post_meta.callback = random;
    }

    var message = { __xd_post_meta: __xd_post_meta, body: data };

    this.log("Sending to" + (self.isChildWindow ? " parent " : " frame "));
    this.log(message);

    this._sendMessage(message);
  };

  XDMessage.prototype.invoke = function(method, data, callback, meta) {
    if (typeof data === 'function') {
      callback = data;
      data = undefined;
    }
    this.send(data, callback, { method: method });
  };

  /*********************************
   Private Methods
  *********************************/
  XDMessage.prototype._receiveMessage = function(event) {
    var allowedURL = this.isChildWindow ? this.windowHostURL : this.frameHostURL;

    if (event.origin === allowedURL) {
      var message;

      try {
        message = JSON.parse(event.data)
      } catch (ex) {
        this.log('message data parsing failed, ignoring');
      }

      if (message && typeof message.__xd_post_meta !== 'undefined' && this.token === message.__xd_post_meta.token) {
        if (typeof message.__xd_post_meta.callback_response === 'string') {
          var callback = this.callbacks[message.__xd_post_meta.callback_response];
          callback(message.body);
          delete(callback);
        } else {
          var method;
          if (message.__xd_post_meta.method) {
            if (this.events[message.__xd_post_meta.method]) {
              method = this.events[message.__xd_post_meta.method]
            }
          } else if (this.events.data) {
            method = this.events.data;
          }

          if (method) {
            if (typeof message.__xd_post_meta.callback === 'string') {
              var self = this;
              method(message.body, function(data){
                self.send(data, { callback_response: message.__xd_post_meta.callback });
              });
            } else {
              method(message.body);
            }
          }
        }
      }
    }
  };

  XDMessage.prototype._sendMessage = function(data) {
    if (this.isChildWindow) {
      if (window.opener) {
        window.opener.postMessage(JSON.stringify(data), this.windowHostURL);
      } else if (window.parent) {
        window.parent.postMessage(JSON.stringify(data), this.windowHostURL);
      }
    } else {
      if (this.options.popup) {
        this.popup.postMessage(JSON.stringify(data), this.frameHostURL);
      } else {
        this.iframe.contentWindow.postMessage(JSON.stringify(data), this.frameHostURL);
      }
    }
  };

  XDMessage.prototype._startListening = function() {
    var self = this;
    self.listener = function(event) {
      self._receiveMessage(event);
    }

    if (document.addEventListener){
      window.addEventListener('message',  self.listener, false);
    } else {
      window.attachEvent('onmessage', self.listener);
    }
  };

  XDMessage.prototype._stopListening = function() {
    if (document.removeEventListener){
      window.removeEventListener('message', this.listener, false);
    } else {
      window.detachEvent('onmessage', this.listener);
    }
  };

  XDMessage.prototype._frameReady = function() {
  };

  XDMessage.prototype._ready = function() {
    if (this.events.ready) {
      this.events.ready();
      // delete(this.events.ready);
    }
  };

  XDMessage.prototype.log = function(message) {
    if (this.options.verbose && typeof console !== 'undefined' && typeof console.log === 'function') {
      console.log(message);
    }
  };

  // Support AMD
  if (typeof define === "function" && define.amd) {
    define("xdmessage", [], function() {
      return XDMessage;
    });
  } else {
    if (typeof exports !== 'undefined') {
      exports.XDMessage = XDMessage;
    } else {
      this.XDMessage = XDMessage;
    }
  }

  XDMessage.noConflict = function() {
    this.XDMessage = _previousXDMessage;
    return this;
  };
}).call(this);
