const manifest = {"name":"EGPU Buddy"};
const API_VERSION = 2;
const internalAPIConnection = window.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit;
if (!internalAPIConnection) {
    throw new Error('[@decky/api]: Failed to connect to the loader as as the loader API was not initialized. This is likely a bug in Decky Loader.');
}
let api;
try {
    api = internalAPIConnection.connect(API_VERSION, manifest.name);
}
catch {
    api = internalAPIConnection.connect(1, manifest.name);
    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version 1. Some features may not work.`);
}
if (api._version != API_VERSION) {
    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version ${api._version}. Some features may not work.`);
}
const callable = api.callable;
const toaster = api.toaster;
const useQuickAccessVisible = api.useQuickAccessVisible;
const definePlugin = (fn) => {
    return (...args) => {
        return fn(...args);
    };
};

var DefaultContext = {
  color: undefined,
  size: undefined,
  className: undefined,
  style: undefined,
  attr: undefined
};
var IconContext = SP_REACT.createContext && /*#__PURE__*/SP_REACT.createContext(DefaultContext);

var _excluded = ["attr", "size", "title"];
function _objectWithoutProperties(e, t) { if (null == e) return {}; var o, r, i = _objectWithoutPropertiesLoose(e, t); if (Object.getOwnPropertySymbols) { var n = Object.getOwnPropertySymbols(e); for (r = 0; r < n.length; r++) o = n[r], -1 === t.indexOf(o) && {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]); } return i; }
function _objectWithoutPropertiesLoose(r, e) { if (null == r) return {}; var t = {}; for (var n in r) if ({}.hasOwnProperty.call(r, n)) { if (-1 !== e.indexOf(n)) continue; t[n] = r[n]; } return t; }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), true).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: true, configurable: true, writable: true }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function Tree2Element(tree) {
  return tree && tree.map((node, i) => /*#__PURE__*/SP_REACT.createElement(node.tag, _objectSpread({
    key: i
  }, node.attr), Tree2Element(node.child)));
}
function GenIcon(data) {
  return props => /*#__PURE__*/SP_REACT.createElement(IconBase, _extends({
    attr: _objectSpread({}, data.attr)
  }, props), Tree2Element(data.child));
}
function IconBase(props) {
  var elem = conf => {
    var {
        attr,
        size,
        title
      } = props,
      svgProps = _objectWithoutProperties(props, _excluded);
    var computedSize = size || conf.size || "1em";
    var className;
    if (conf.className) className = conf.className;
    if (props.className) className = (className ? className + " " : "") + props.className;
    return /*#__PURE__*/SP_REACT.createElement("svg", _extends({
      stroke: "currentColor",
      fill: "currentColor",
      strokeWidth: "0"
    }, conf.attr, attr, svgProps, {
      className: className,
      style: _objectSpread(_objectSpread({
        color: props.color || conf.color
      }, conf.style), props.style),
      height: computedSize,
      width: computedSize,
      xmlns: "http://www.w3.org/2000/svg"
    }), title && /*#__PURE__*/SP_REACT.createElement("title", null, title), props.children);
  };
  return IconContext !== undefined ? /*#__PURE__*/SP_REACT.createElement(IconContext.Consumer, null, conf => elem(conf)) : elem(DefaultContext);
}

// THIS FILE IS AUTO GENERATED
function FaPlug (props) {
  return GenIcon({"attr":{"viewBox":"0 0 384 512"},"child":[{"tag":"path","attr":{"d":"M320,32a32,32,0,0,0-64,0v96h64Zm48,128H16A16,16,0,0,0,0,176v32a16,16,0,0,0,16,16H32v32A160.07,160.07,0,0,0,160,412.8V512h64V412.8A160.07,160.07,0,0,0,352,256V224h16a16,16,0,0,0,16-16V176A16,16,0,0,0,368,160ZM128,32a32,32,0,0,0-64,0v96h64Z"},"child":[]}]})(props);
}

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var qrcode$1 = {exports: {}};

(function (module, exports) {
	//---------------------------------------------------------------------
	//
	// QR Code Generator for JavaScript
	//
	// Copyright (c) 2009 Kazuhiko Arase
	//
	// URL: http://www.d-project.com/
	//
	// Licensed under the MIT license:
	//  http://www.opensource.org/licenses/mit-license.php
	//
	// The word 'QR Code' is registered trademark of
	// DENSO WAVE INCORPORATED
	//  http://www.denso-wave.com/qrcode/faqpatent-e.html
	//
	//---------------------------------------------------------------------

	var qrcode = function() {

	  //---------------------------------------------------------------------
	  // qrcode
	  //---------------------------------------------------------------------

	  /**
	   * qrcode
	   * @param typeNumber 1 to 40
	   * @param errorCorrectionLevel 'L','M','Q','H'
	   */
	  var qrcode = function(typeNumber, errorCorrectionLevel) {

	    var PAD0 = 0xEC;
	    var PAD1 = 0x11;

	    var _typeNumber = typeNumber;
	    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
	    var _modules = null;
	    var _moduleCount = 0;
	    var _dataCache = null;
	    var _dataList = [];

	    var _this = {};

	    var makeImpl = function(test, maskPattern) {

	      _moduleCount = _typeNumber * 4 + 17;
	      _modules = function(moduleCount) {
	        var modules = new Array(moduleCount);
	        for (var row = 0; row < moduleCount; row += 1) {
	          modules[row] = new Array(moduleCount);
	          for (var col = 0; col < moduleCount; col += 1) {
	            modules[row][col] = null;
	          }
	        }
	        return modules;
	      }(_moduleCount);

	      setupPositionProbePattern(0, 0);
	      setupPositionProbePattern(_moduleCount - 7, 0);
	      setupPositionProbePattern(0, _moduleCount - 7);
	      setupPositionAdjustPattern();
	      setupTimingPattern();
	      setupTypeInfo(test, maskPattern);

	      if (_typeNumber >= 7) {
	        setupTypeNumber(test);
	      }

	      if (_dataCache == null) {
	        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
	      }

	      mapData(_dataCache, maskPattern);
	    };

	    var setupPositionProbePattern = function(row, col) {

	      for (var r = -1; r <= 7; r += 1) {

	        if (row + r <= -1 || _moduleCount <= row + r) continue;

	        for (var c = -1; c <= 7; c += 1) {

	          if (col + c <= -1 || _moduleCount <= col + c) continue;

	          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
	              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
	              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
	            _modules[row + r][col + c] = true;
	          } else {
	            _modules[row + r][col + c] = false;
	          }
	        }
	      }
	    };

	    var getBestMaskPattern = function() {

	      var minLostPoint = 0;
	      var pattern = 0;

	      for (var i = 0; i < 8; i += 1) {

	        makeImpl(true, i);

	        var lostPoint = QRUtil.getLostPoint(_this);

	        if (i == 0 || minLostPoint > lostPoint) {
	          minLostPoint = lostPoint;
	          pattern = i;
	        }
	      }

	      return pattern;
	    };

	    var setupTimingPattern = function() {

	      for (var r = 8; r < _moduleCount - 8; r += 1) {
	        if (_modules[r][6] != null) {
	          continue;
	        }
	        _modules[r][6] = (r % 2 == 0);
	      }

	      for (var c = 8; c < _moduleCount - 8; c += 1) {
	        if (_modules[6][c] != null) {
	          continue;
	        }
	        _modules[6][c] = (c % 2 == 0);
	      }
	    };

	    var setupPositionAdjustPattern = function() {

	      var pos = QRUtil.getPatternPosition(_typeNumber);

	      for (var i = 0; i < pos.length; i += 1) {

	        for (var j = 0; j < pos.length; j += 1) {

	          var row = pos[i];
	          var col = pos[j];

	          if (_modules[row][col] != null) {
	            continue;
	          }

	          for (var r = -2; r <= 2; r += 1) {

	            for (var c = -2; c <= 2; c += 1) {

	              if (r == -2 || r == 2 || c == -2 || c == 2
	                  || (r == 0 && c == 0) ) {
	                _modules[row + r][col + c] = true;
	              } else {
	                _modules[row + r][col + c] = false;
	              }
	            }
	          }
	        }
	      }
	    };

	    var setupTypeNumber = function(test) {

	      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

	      for (var i = 0; i < 18; i += 1) {
	        var mod = (!test && ( (bits >> i) & 1) == 1);
	        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
	      }

	      for (var i = 0; i < 18; i += 1) {
	        var mod = (!test && ( (bits >> i) & 1) == 1);
	        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
	      }
	    };

	    var setupTypeInfo = function(test, maskPattern) {

	      var data = (_errorCorrectionLevel << 3) | maskPattern;
	      var bits = QRUtil.getBCHTypeInfo(data);

	      // vertical
	      for (var i = 0; i < 15; i += 1) {

	        var mod = (!test && ( (bits >> i) & 1) == 1);

	        if (i < 6) {
	          _modules[i][8] = mod;
	        } else if (i < 8) {
	          _modules[i + 1][8] = mod;
	        } else {
	          _modules[_moduleCount - 15 + i][8] = mod;
	        }
	      }

	      // horizontal
	      for (var i = 0; i < 15; i += 1) {

	        var mod = (!test && ( (bits >> i) & 1) == 1);

	        if (i < 8) {
	          _modules[8][_moduleCount - i - 1] = mod;
	        } else if (i < 9) {
	          _modules[8][15 - i - 1 + 1] = mod;
	        } else {
	          _modules[8][15 - i - 1] = mod;
	        }
	      }

	      // fixed module
	      _modules[_moduleCount - 8][8] = (!test);
	    };

	    var mapData = function(data, maskPattern) {

	      var inc = -1;
	      var row = _moduleCount - 1;
	      var bitIndex = 7;
	      var byteIndex = 0;
	      var maskFunc = QRUtil.getMaskFunction(maskPattern);

	      for (var col = _moduleCount - 1; col > 0; col -= 2) {

	        if (col == 6) col -= 1;

	        while (true) {

	          for (var c = 0; c < 2; c += 1) {

	            if (_modules[row][col - c] == null) {

	              var dark = false;

	              if (byteIndex < data.length) {
	                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
	              }

	              var mask = maskFunc(row, col - c);

	              if (mask) {
	                dark = !dark;
	              }

	              _modules[row][col - c] = dark;
	              bitIndex -= 1;

	              if (bitIndex == -1) {
	                byteIndex += 1;
	                bitIndex = 7;
	              }
	            }
	          }

	          row += inc;

	          if (row < 0 || _moduleCount <= row) {
	            row -= inc;
	            inc = -inc;
	            break;
	          }
	        }
	      }
	    };

	    var createBytes = function(buffer, rsBlocks) {

	      var offset = 0;

	      var maxDcCount = 0;
	      var maxEcCount = 0;

	      var dcdata = new Array(rsBlocks.length);
	      var ecdata = new Array(rsBlocks.length);

	      for (var r = 0; r < rsBlocks.length; r += 1) {

	        var dcCount = rsBlocks[r].dataCount;
	        var ecCount = rsBlocks[r].totalCount - dcCount;

	        maxDcCount = Math.max(maxDcCount, dcCount);
	        maxEcCount = Math.max(maxEcCount, ecCount);

	        dcdata[r] = new Array(dcCount);

	        for (var i = 0; i < dcdata[r].length; i += 1) {
	          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
	        }
	        offset += dcCount;

	        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
	        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

	        var modPoly = rawPoly.mod(rsPoly);
	        ecdata[r] = new Array(rsPoly.getLength() - 1);
	        for (var i = 0; i < ecdata[r].length; i += 1) {
	          var modIndex = i + modPoly.getLength() - ecdata[r].length;
	          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
	        }
	      }

	      var totalCodeCount = 0;
	      for (var i = 0; i < rsBlocks.length; i += 1) {
	        totalCodeCount += rsBlocks[i].totalCount;
	      }

	      var data = new Array(totalCodeCount);
	      var index = 0;

	      for (var i = 0; i < maxDcCount; i += 1) {
	        for (var r = 0; r < rsBlocks.length; r += 1) {
	          if (i < dcdata[r].length) {
	            data[index] = dcdata[r][i];
	            index += 1;
	          }
	        }
	      }

	      for (var i = 0; i < maxEcCount; i += 1) {
	        for (var r = 0; r < rsBlocks.length; r += 1) {
	          if (i < ecdata[r].length) {
	            data[index] = ecdata[r][i];
	            index += 1;
	          }
	        }
	      }

	      return data;
	    };

	    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

	      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

	      var buffer = qrBitBuffer();

	      for (var i = 0; i < dataList.length; i += 1) {
	        var data = dataList[i];
	        buffer.put(data.getMode(), 4);
	        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
	        data.write(buffer);
	      }

	      // calc num max data.
	      var totalDataCount = 0;
	      for (var i = 0; i < rsBlocks.length; i += 1) {
	        totalDataCount += rsBlocks[i].dataCount;
	      }

	      if (buffer.getLengthInBits() > totalDataCount * 8) {
	        throw 'code length overflow. ('
	          + buffer.getLengthInBits()
	          + '>'
	          + totalDataCount * 8
	          + ')';
	      }

	      // end code
	      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
	        buffer.put(0, 4);
	      }

	      // padding
	      while (buffer.getLengthInBits() % 8 != 0) {
	        buffer.putBit(false);
	      }

	      // padding
	      while (true) {

	        if (buffer.getLengthInBits() >= totalDataCount * 8) {
	          break;
	        }
	        buffer.put(PAD0, 8);

	        if (buffer.getLengthInBits() >= totalDataCount * 8) {
	          break;
	        }
	        buffer.put(PAD1, 8);
	      }

	      return createBytes(buffer, rsBlocks);
	    };

	    _this.addData = function(data, mode) {

	      mode = mode || 'Byte';

	      var newData = null;

	      switch(mode) {
	      case 'Numeric' :
	        newData = qrNumber(data);
	        break;
	      case 'Alphanumeric' :
	        newData = qrAlphaNum(data);
	        break;
	      case 'Byte' :
	        newData = qr8BitByte(data);
	        break;
	      case 'Kanji' :
	        newData = qrKanji(data);
	        break;
	      default :
	        throw 'mode:' + mode;
	      }

	      _dataList.push(newData);
	      _dataCache = null;
	    };

	    _this.isDark = function(row, col) {
	      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
	        throw row + ',' + col;
	      }
	      return _modules[row][col];
	    };

	    _this.getModuleCount = function() {
	      return _moduleCount;
	    };

	    _this.make = function() {
	      if (_typeNumber < 1) {
	        var typeNumber = 1;

	        for (; typeNumber < 40; typeNumber++) {
	          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
	          var buffer = qrBitBuffer();

	          for (var i = 0; i < _dataList.length; i++) {
	            var data = _dataList[i];
	            buffer.put(data.getMode(), 4);
	            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
	            data.write(buffer);
	          }

	          var totalDataCount = 0;
	          for (var i = 0; i < rsBlocks.length; i++) {
	            totalDataCount += rsBlocks[i].dataCount;
	          }

	          if (buffer.getLengthInBits() <= totalDataCount * 8) {
	            break;
	          }
	        }

	        _typeNumber = typeNumber;
	      }

	      makeImpl(false, getBestMaskPattern() );
	    };

	    _this.createTableTag = function(cellSize, margin) {

	      cellSize = cellSize || 2;
	      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

	      var qrHtml = '';

	      qrHtml += '<table style="';
	      qrHtml += ' border-width: 0px; border-style: none;';
	      qrHtml += ' border-collapse: collapse;';
	      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
	      qrHtml += '">';
	      qrHtml += '<tbody>';

	      for (var r = 0; r < _this.getModuleCount(); r += 1) {

	        qrHtml += '<tr>';

	        for (var c = 0; c < _this.getModuleCount(); c += 1) {
	          qrHtml += '<td style="';
	          qrHtml += ' border-width: 0px; border-style: none;';
	          qrHtml += ' border-collapse: collapse;';
	          qrHtml += ' padding: 0px; margin: 0px;';
	          qrHtml += ' width: ' + cellSize + 'px;';
	          qrHtml += ' height: ' + cellSize + 'px;';
	          qrHtml += ' background-color: ';
	          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
	          qrHtml += ';';
	          qrHtml += '"/>';
	        }

	        qrHtml += '</tr>';
	      }

	      qrHtml += '</tbody>';
	      qrHtml += '</table>';

	      return qrHtml;
	    };

	    _this.createSvgTag = function(cellSize, margin, alt, title) {

	      var opts = {};
	      if (typeof arguments[0] == 'object') {
	        // Called by options.
	        opts = arguments[0];
	        // overwrite cellSize and margin.
	        cellSize = opts.cellSize;
	        margin = opts.margin;
	        alt = opts.alt;
	        title = opts.title;
	      }

	      cellSize = cellSize || 2;
	      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

	      // Compose alt property surrogate
	      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
	      alt.text = alt.text || null;
	      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

	      // Compose title property surrogate
	      title = (typeof title === 'string') ? {text: title} : title || {};
	      title.text = title.text || null;
	      title.id = (title.text) ? title.id || 'qrcode-title' : null;

	      var size = _this.getModuleCount() * cellSize + margin * 2;
	      var c, mc, r, mr, qrSvg='', rect;

	      rect = 'l' + cellSize + ',0 0,' + cellSize +
	        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

	      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
	      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
	      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
	      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
	      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
	          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
	      qrSvg += '>';
	      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
	          escapeXml(title.text) + '</title>' : '';
	      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
	          escapeXml(alt.text) + '</description>' : '';
	      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
	      qrSvg += '<path d="';

	      for (r = 0; r < _this.getModuleCount(); r += 1) {
	        mr = r * cellSize + margin;
	        for (c = 0; c < _this.getModuleCount(); c += 1) {
	          if (_this.isDark(r, c) ) {
	            mc = c*cellSize+margin;
	            qrSvg += 'M' + mc + ',' + mr + rect;
	          }
	        }
	      }

	      qrSvg += '" stroke="transparent" fill="black"/>';
	      qrSvg += '</svg>';

	      return qrSvg;
	    };

	    _this.createDataURL = function(cellSize, margin) {

	      cellSize = cellSize || 2;
	      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

	      var size = _this.getModuleCount() * cellSize + margin * 2;
	      var min = margin;
	      var max = size - margin;

	      return createDataURL(size, size, function(x, y) {
	        if (min <= x && x < max && min <= y && y < max) {
	          var c = Math.floor( (x - min) / cellSize);
	          var r = Math.floor( (y - min) / cellSize);
	          return _this.isDark(r, c)? 0 : 1;
	        } else {
	          return 1;
	        }
	      } );
	    };

	    _this.createImgTag = function(cellSize, margin, alt) {

	      cellSize = cellSize || 2;
	      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

	      var size = _this.getModuleCount() * cellSize + margin * 2;

	      var img = '';
	      img += '<img';
	      img += '\u0020src="';
	      img += _this.createDataURL(cellSize, margin);
	      img += '"';
	      img += '\u0020width="';
	      img += size;
	      img += '"';
	      img += '\u0020height="';
	      img += size;
	      img += '"';
	      if (alt) {
	        img += '\u0020alt="';
	        img += escapeXml(alt);
	        img += '"';
	      }
	      img += '/>';

	      return img;
	    };

	    var escapeXml = function(s) {
	      var escaped = '';
	      for (var i = 0; i < s.length; i += 1) {
	        var c = s.charAt(i);
	        switch(c) {
	        case '<': escaped += '&lt;'; break;
	        case '>': escaped += '&gt;'; break;
	        case '&': escaped += '&amp;'; break;
	        case '"': escaped += '&quot;'; break;
	        default : escaped += c; break;
	        }
	      }
	      return escaped;
	    };

	    var _createHalfASCII = function(margin) {
	      var cellSize = 1;
	      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

	      var size = _this.getModuleCount() * cellSize + margin * 2;
	      var min = margin;
	      var max = size - margin;

	      var y, x, r1, r2, p;

	      var blocks = {
	        '██': '█',
	        '█ ': '▀',
	        ' █': '▄',
	        '  ': ' '
	      };

	      var blocksLastLineNoMargin = {
	        '██': '▀',
	        '█ ': '▀',
	        ' █': ' ',
	        '  ': ' '
	      };

	      var ascii = '';
	      for (y = 0; y < size; y += 2) {
	        r1 = Math.floor((y - min) / cellSize);
	        r2 = Math.floor((y + 1 - min) / cellSize);
	        for (x = 0; x < size; x += 1) {
	          p = '█';

	          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
	            p = ' ';
	          }

	          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
	            p += ' ';
	          }
	          else {
	            p += '█';
	          }

	          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
	          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
	        }

	        ascii += '\n';
	      }

	      if (size % 2 && margin > 0) {
	        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
	      }

	      return ascii.substring(0, ascii.length-1);
	    };

	    _this.createASCII = function(cellSize, margin) {
	      cellSize = cellSize || 1;

	      if (cellSize < 2) {
	        return _createHalfASCII(margin);
	      }

	      cellSize -= 1;
	      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

	      var size = _this.getModuleCount() * cellSize + margin * 2;
	      var min = margin;
	      var max = size - margin;

	      var y, x, r, p;

	      var white = Array(cellSize+1).join('██');
	      var black = Array(cellSize+1).join('  ');

	      var ascii = '';
	      var line = '';
	      for (y = 0; y < size; y += 1) {
	        r = Math.floor( (y - min) / cellSize);
	        line = '';
	        for (x = 0; x < size; x += 1) {
	          p = 1;

	          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
	            p = 0;
	          }

	          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
	          line += p ? white : black;
	        }

	        for (r = 0; r < cellSize; r += 1) {
	          ascii += line + '\n';
	        }
	      }

	      return ascii.substring(0, ascii.length-1);
	    };

	    _this.renderTo2dContext = function(context, cellSize) {
	      cellSize = cellSize || 2;
	      var length = _this.getModuleCount();
	      for (var row = 0; row < length; row++) {
	        for (var col = 0; col < length; col++) {
	          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
	          context.fillRect(row * cellSize, col * cellSize, cellSize, cellSize);
	        }
	      }
	    };

	    return _this;
	  };

	  //---------------------------------------------------------------------
	  // qrcode.stringToBytes
	  //---------------------------------------------------------------------

	  qrcode.stringToBytesFuncs = {
	    'default' : function(s) {
	      var bytes = [];
	      for (var i = 0; i < s.length; i += 1) {
	        var c = s.charCodeAt(i);
	        bytes.push(c & 0xff);
	      }
	      return bytes;
	    }
	  };

	  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

	  //---------------------------------------------------------------------
	  // qrcode.createStringToBytes
	  //---------------------------------------------------------------------

	  /**
	   * @param unicodeData base64 string of byte array.
	   * [16bit Unicode],[16bit Bytes], ...
	   * @param numChars
	   */
	  qrcode.createStringToBytes = function(unicodeData, numChars) {

	    // create conversion map.

	    var unicodeMap = function() {

	      var bin = base64DecodeInputStream(unicodeData);
	      var read = function() {
	        var b = bin.read();
	        if (b == -1) throw 'eof';
	        return b;
	      };

	      var count = 0;
	      var unicodeMap = {};
	      while (true) {
	        var b0 = bin.read();
	        if (b0 == -1) break;
	        var b1 = read();
	        var b2 = read();
	        var b3 = read();
	        var k = String.fromCharCode( (b0 << 8) | b1);
	        var v = (b2 << 8) | b3;
	        unicodeMap[k] = v;
	        count += 1;
	      }
	      if (count != numChars) {
	        throw count + ' != ' + numChars;
	      }

	      return unicodeMap;
	    }();

	    var unknownChar = '?'.charCodeAt(0);

	    return function(s) {
	      var bytes = [];
	      for (var i = 0; i < s.length; i += 1) {
	        var c = s.charCodeAt(i);
	        if (c < 128) {
	          bytes.push(c);
	        } else {
	          var b = unicodeMap[s.charAt(i)];
	          if (typeof b == 'number') {
	            if ( (b & 0xff) == b) {
	              // 1byte
	              bytes.push(b);
	            } else {
	              // 2bytes
	              bytes.push(b >>> 8);
	              bytes.push(b & 0xff);
	            }
	          } else {
	            bytes.push(unknownChar);
	          }
	        }
	      }
	      return bytes;
	    };
	  };

	  //---------------------------------------------------------------------
	  // QRMode
	  //---------------------------------------------------------------------

	  var QRMode = {
	    MODE_NUMBER :    1 << 0,
	    MODE_ALPHA_NUM : 1 << 1,
	    MODE_8BIT_BYTE : 1 << 2,
	    MODE_KANJI :     1 << 3
	  };

	  //---------------------------------------------------------------------
	  // QRErrorCorrectionLevel
	  //---------------------------------------------------------------------

	  var QRErrorCorrectionLevel = {
	    L : 1,
	    M : 0,
	    Q : 3,
	    H : 2
	  };

	  //---------------------------------------------------------------------
	  // QRMaskPattern
	  //---------------------------------------------------------------------

	  var QRMaskPattern = {
	    PATTERN000 : 0,
	    PATTERN001 : 1,
	    PATTERN010 : 2,
	    PATTERN011 : 3,
	    PATTERN100 : 4,
	    PATTERN101 : 5,
	    PATTERN110 : 6,
	    PATTERN111 : 7
	  };

	  //---------------------------------------------------------------------
	  // QRUtil
	  //---------------------------------------------------------------------

	  var QRUtil = function() {

	    var PATTERN_POSITION_TABLE = [
	      [],
	      [6, 18],
	      [6, 22],
	      [6, 26],
	      [6, 30],
	      [6, 34],
	      [6, 22, 38],
	      [6, 24, 42],
	      [6, 26, 46],
	      [6, 28, 50],
	      [6, 30, 54],
	      [6, 32, 58],
	      [6, 34, 62],
	      [6, 26, 46, 66],
	      [6, 26, 48, 70],
	      [6, 26, 50, 74],
	      [6, 30, 54, 78],
	      [6, 30, 56, 82],
	      [6, 30, 58, 86],
	      [6, 34, 62, 90],
	      [6, 28, 50, 72, 94],
	      [6, 26, 50, 74, 98],
	      [6, 30, 54, 78, 102],
	      [6, 28, 54, 80, 106],
	      [6, 32, 58, 84, 110],
	      [6, 30, 58, 86, 114],
	      [6, 34, 62, 90, 118],
	      [6, 26, 50, 74, 98, 122],
	      [6, 30, 54, 78, 102, 126],
	      [6, 26, 52, 78, 104, 130],
	      [6, 30, 56, 82, 108, 134],
	      [6, 34, 60, 86, 112, 138],
	      [6, 30, 58, 86, 114, 142],
	      [6, 34, 62, 90, 118, 146],
	      [6, 30, 54, 78, 102, 126, 150],
	      [6, 24, 50, 76, 102, 128, 154],
	      [6, 28, 54, 80, 106, 132, 158],
	      [6, 32, 58, 84, 110, 136, 162],
	      [6, 26, 54, 82, 110, 138, 166],
	      [6, 30, 58, 86, 114, 142, 170]
	    ];
	    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
	    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
	    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

	    var _this = {};

	    var getBCHDigit = function(data) {
	      var digit = 0;
	      while (data != 0) {
	        digit += 1;
	        data >>>= 1;
	      }
	      return digit;
	    };

	    _this.getBCHTypeInfo = function(data) {
	      var d = data << 10;
	      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
	        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
	      }
	      return ( (data << 10) | d) ^ G15_MASK;
	    };

	    _this.getBCHTypeNumber = function(data) {
	      var d = data << 12;
	      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
	        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
	      }
	      return (data << 12) | d;
	    };

	    _this.getPatternPosition = function(typeNumber) {
	      return PATTERN_POSITION_TABLE[typeNumber - 1];
	    };

	    _this.getMaskFunction = function(maskPattern) {

	      switch (maskPattern) {

	      case QRMaskPattern.PATTERN000 :
	        return function(i, j) { return (i + j) % 2 == 0; };
	      case QRMaskPattern.PATTERN001 :
	        return function(i, j) { return i % 2 == 0; };
	      case QRMaskPattern.PATTERN010 :
	        return function(i, j) { return j % 3 == 0; };
	      case QRMaskPattern.PATTERN011 :
	        return function(i, j) { return (i + j) % 3 == 0; };
	      case QRMaskPattern.PATTERN100 :
	        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
	      case QRMaskPattern.PATTERN101 :
	        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
	      case QRMaskPattern.PATTERN110 :
	        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
	      case QRMaskPattern.PATTERN111 :
	        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

	      default :
	        throw 'bad maskPattern:' + maskPattern;
	      }
	    };

	    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
	      var a = qrPolynomial([1], 0);
	      for (var i = 0; i < errorCorrectLength; i += 1) {
	        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
	      }
	      return a;
	    };

	    _this.getLengthInBits = function(mode, type) {

	      if (1 <= type && type < 10) {

	        // 1 - 9

	        switch(mode) {
	        case QRMode.MODE_NUMBER    : return 10;
	        case QRMode.MODE_ALPHA_NUM : return 9;
	        case QRMode.MODE_8BIT_BYTE : return 8;
	        case QRMode.MODE_KANJI     : return 8;
	        default :
	          throw 'mode:' + mode;
	        }

	      } else if (type < 27) {

	        // 10 - 26

	        switch(mode) {
	        case QRMode.MODE_NUMBER    : return 12;
	        case QRMode.MODE_ALPHA_NUM : return 11;
	        case QRMode.MODE_8BIT_BYTE : return 16;
	        case QRMode.MODE_KANJI     : return 10;
	        default :
	          throw 'mode:' + mode;
	        }

	      } else if (type < 41) {

	        // 27 - 40

	        switch(mode) {
	        case QRMode.MODE_NUMBER    : return 14;
	        case QRMode.MODE_ALPHA_NUM : return 13;
	        case QRMode.MODE_8BIT_BYTE : return 16;
	        case QRMode.MODE_KANJI     : return 12;
	        default :
	          throw 'mode:' + mode;
	        }

	      } else {
	        throw 'type:' + type;
	      }
	    };

	    _this.getLostPoint = function(qrcode) {

	      var moduleCount = qrcode.getModuleCount();

	      var lostPoint = 0;

	      // LEVEL1

	      for (var row = 0; row < moduleCount; row += 1) {
	        for (var col = 0; col < moduleCount; col += 1) {

	          var sameCount = 0;
	          var dark = qrcode.isDark(row, col);

	          for (var r = -1; r <= 1; r += 1) {

	            if (row + r < 0 || moduleCount <= row + r) {
	              continue;
	            }

	            for (var c = -1; c <= 1; c += 1) {

	              if (col + c < 0 || moduleCount <= col + c) {
	                continue;
	              }

	              if (r == 0 && c == 0) {
	                continue;
	              }

	              if (dark == qrcode.isDark(row + r, col + c) ) {
	                sameCount += 1;
	              }
	            }
	          }

	          if (sameCount > 5) {
	            lostPoint += (3 + sameCount - 5);
	          }
	        }
	      }
	      // LEVEL2

	      for (var row = 0; row < moduleCount - 1; row += 1) {
	        for (var col = 0; col < moduleCount - 1; col += 1) {
	          var count = 0;
	          if (qrcode.isDark(row, col) ) count += 1;
	          if (qrcode.isDark(row + 1, col) ) count += 1;
	          if (qrcode.isDark(row, col + 1) ) count += 1;
	          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
	          if (count == 0 || count == 4) {
	            lostPoint += 3;
	          }
	        }
	      }

	      // LEVEL3

	      for (var row = 0; row < moduleCount; row += 1) {
	        for (var col = 0; col < moduleCount - 6; col += 1) {
	          if (qrcode.isDark(row, col)
	              && !qrcode.isDark(row, col + 1)
	              &&  qrcode.isDark(row, col + 2)
	              &&  qrcode.isDark(row, col + 3)
	              &&  qrcode.isDark(row, col + 4)
	              && !qrcode.isDark(row, col + 5)
	              &&  qrcode.isDark(row, col + 6) ) {
	            lostPoint += 40;
	          }
	        }
	      }

	      for (var col = 0; col < moduleCount; col += 1) {
	        for (var row = 0; row < moduleCount - 6; row += 1) {
	          if (qrcode.isDark(row, col)
	              && !qrcode.isDark(row + 1, col)
	              &&  qrcode.isDark(row + 2, col)
	              &&  qrcode.isDark(row + 3, col)
	              &&  qrcode.isDark(row + 4, col)
	              && !qrcode.isDark(row + 5, col)
	              &&  qrcode.isDark(row + 6, col) ) {
	            lostPoint += 40;
	          }
	        }
	      }

	      // LEVEL4

	      var darkCount = 0;

	      for (var col = 0; col < moduleCount; col += 1) {
	        for (var row = 0; row < moduleCount; row += 1) {
	          if (qrcode.isDark(row, col) ) {
	            darkCount += 1;
	          }
	        }
	      }

	      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
	      lostPoint += ratio * 10;

	      return lostPoint;
	    };

	    return _this;
	  }();

	  //---------------------------------------------------------------------
	  // QRMath
	  //---------------------------------------------------------------------

	  var QRMath = function() {

	    var EXP_TABLE = new Array(256);
	    var LOG_TABLE = new Array(256);

	    // initialize tables
	    for (var i = 0; i < 8; i += 1) {
	      EXP_TABLE[i] = 1 << i;
	    }
	    for (var i = 8; i < 256; i += 1) {
	      EXP_TABLE[i] = EXP_TABLE[i - 4]
	        ^ EXP_TABLE[i - 5]
	        ^ EXP_TABLE[i - 6]
	        ^ EXP_TABLE[i - 8];
	    }
	    for (var i = 0; i < 255; i += 1) {
	      LOG_TABLE[EXP_TABLE[i] ] = i;
	    }

	    var _this = {};

	    _this.glog = function(n) {

	      if (n < 1) {
	        throw 'glog(' + n + ')';
	      }

	      return LOG_TABLE[n];
	    };

	    _this.gexp = function(n) {

	      while (n < 0) {
	        n += 255;
	      }

	      while (n >= 256) {
	        n -= 255;
	      }

	      return EXP_TABLE[n];
	    };

	    return _this;
	  }();

	  //---------------------------------------------------------------------
	  // qrPolynomial
	  //---------------------------------------------------------------------

	  function qrPolynomial(num, shift) {

	    if (typeof num.length == 'undefined') {
	      throw num.length + '/' + shift;
	    }

	    var _num = function() {
	      var offset = 0;
	      while (offset < num.length && num[offset] == 0) {
	        offset += 1;
	      }
	      var _num = new Array(num.length - offset + shift);
	      for (var i = 0; i < num.length - offset; i += 1) {
	        _num[i] = num[i + offset];
	      }
	      return _num;
	    }();

	    var _this = {};

	    _this.getAt = function(index) {
	      return _num[index];
	    };

	    _this.getLength = function() {
	      return _num.length;
	    };

	    _this.multiply = function(e) {

	      var num = new Array(_this.getLength() + e.getLength() - 1);

	      for (var i = 0; i < _this.getLength(); i += 1) {
	        for (var j = 0; j < e.getLength(); j += 1) {
	          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
	        }
	      }

	      return qrPolynomial(num, 0);
	    };

	    _this.mod = function(e) {

	      if (_this.getLength() - e.getLength() < 0) {
	        return _this;
	      }

	      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

	      var num = new Array(_this.getLength() );
	      for (var i = 0; i < _this.getLength(); i += 1) {
	        num[i] = _this.getAt(i);
	      }

	      for (var i = 0; i < e.getLength(); i += 1) {
	        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
	      }

	      // recursive call
	      return qrPolynomial(num, 0).mod(e);
	    };

	    return _this;
	  }
	  //---------------------------------------------------------------------
	  // QRRSBlock
	  //---------------------------------------------------------------------

	  var QRRSBlock = function() {

	    var RS_BLOCK_TABLE = [

	      // L
	      // M
	      // Q
	      // H

	      // 1
	      [1, 26, 19],
	      [1, 26, 16],
	      [1, 26, 13],
	      [1, 26, 9],

	      // 2
	      [1, 44, 34],
	      [1, 44, 28],
	      [1, 44, 22],
	      [1, 44, 16],

	      // 3
	      [1, 70, 55],
	      [1, 70, 44],
	      [2, 35, 17],
	      [2, 35, 13],

	      // 4
	      [1, 100, 80],
	      [2, 50, 32],
	      [2, 50, 24],
	      [4, 25, 9],

	      // 5
	      [1, 134, 108],
	      [2, 67, 43],
	      [2, 33, 15, 2, 34, 16],
	      [2, 33, 11, 2, 34, 12],

	      // 6
	      [2, 86, 68],
	      [4, 43, 27],
	      [4, 43, 19],
	      [4, 43, 15],

	      // 7
	      [2, 98, 78],
	      [4, 49, 31],
	      [2, 32, 14, 4, 33, 15],
	      [4, 39, 13, 1, 40, 14],

	      // 8
	      [2, 121, 97],
	      [2, 60, 38, 2, 61, 39],
	      [4, 40, 18, 2, 41, 19],
	      [4, 40, 14, 2, 41, 15],

	      // 9
	      [2, 146, 116],
	      [3, 58, 36, 2, 59, 37],
	      [4, 36, 16, 4, 37, 17],
	      [4, 36, 12, 4, 37, 13],

	      // 10
	      [2, 86, 68, 2, 87, 69],
	      [4, 69, 43, 1, 70, 44],
	      [6, 43, 19, 2, 44, 20],
	      [6, 43, 15, 2, 44, 16],

	      // 11
	      [4, 101, 81],
	      [1, 80, 50, 4, 81, 51],
	      [4, 50, 22, 4, 51, 23],
	      [3, 36, 12, 8, 37, 13],

	      // 12
	      [2, 116, 92, 2, 117, 93],
	      [6, 58, 36, 2, 59, 37],
	      [4, 46, 20, 6, 47, 21],
	      [7, 42, 14, 4, 43, 15],

	      // 13
	      [4, 133, 107],
	      [8, 59, 37, 1, 60, 38],
	      [8, 44, 20, 4, 45, 21],
	      [12, 33, 11, 4, 34, 12],

	      // 14
	      [3, 145, 115, 1, 146, 116],
	      [4, 64, 40, 5, 65, 41],
	      [11, 36, 16, 5, 37, 17],
	      [11, 36, 12, 5, 37, 13],

	      // 15
	      [5, 109, 87, 1, 110, 88],
	      [5, 65, 41, 5, 66, 42],
	      [5, 54, 24, 7, 55, 25],
	      [11, 36, 12, 7, 37, 13],

	      // 16
	      [5, 122, 98, 1, 123, 99],
	      [7, 73, 45, 3, 74, 46],
	      [15, 43, 19, 2, 44, 20],
	      [3, 45, 15, 13, 46, 16],

	      // 17
	      [1, 135, 107, 5, 136, 108],
	      [10, 74, 46, 1, 75, 47],
	      [1, 50, 22, 15, 51, 23],
	      [2, 42, 14, 17, 43, 15],

	      // 18
	      [5, 150, 120, 1, 151, 121],
	      [9, 69, 43, 4, 70, 44],
	      [17, 50, 22, 1, 51, 23],
	      [2, 42, 14, 19, 43, 15],

	      // 19
	      [3, 141, 113, 4, 142, 114],
	      [3, 70, 44, 11, 71, 45],
	      [17, 47, 21, 4, 48, 22],
	      [9, 39, 13, 16, 40, 14],

	      // 20
	      [3, 135, 107, 5, 136, 108],
	      [3, 67, 41, 13, 68, 42],
	      [15, 54, 24, 5, 55, 25],
	      [15, 43, 15, 10, 44, 16],

	      // 21
	      [4, 144, 116, 4, 145, 117],
	      [17, 68, 42],
	      [17, 50, 22, 6, 51, 23],
	      [19, 46, 16, 6, 47, 17],

	      // 22
	      [2, 139, 111, 7, 140, 112],
	      [17, 74, 46],
	      [7, 54, 24, 16, 55, 25],
	      [34, 37, 13],

	      // 23
	      [4, 151, 121, 5, 152, 122],
	      [4, 75, 47, 14, 76, 48],
	      [11, 54, 24, 14, 55, 25],
	      [16, 45, 15, 14, 46, 16],

	      // 24
	      [6, 147, 117, 4, 148, 118],
	      [6, 73, 45, 14, 74, 46],
	      [11, 54, 24, 16, 55, 25],
	      [30, 46, 16, 2, 47, 17],

	      // 25
	      [8, 132, 106, 4, 133, 107],
	      [8, 75, 47, 13, 76, 48],
	      [7, 54, 24, 22, 55, 25],
	      [22, 45, 15, 13, 46, 16],

	      // 26
	      [10, 142, 114, 2, 143, 115],
	      [19, 74, 46, 4, 75, 47],
	      [28, 50, 22, 6, 51, 23],
	      [33, 46, 16, 4, 47, 17],

	      // 27
	      [8, 152, 122, 4, 153, 123],
	      [22, 73, 45, 3, 74, 46],
	      [8, 53, 23, 26, 54, 24],
	      [12, 45, 15, 28, 46, 16],

	      // 28
	      [3, 147, 117, 10, 148, 118],
	      [3, 73, 45, 23, 74, 46],
	      [4, 54, 24, 31, 55, 25],
	      [11, 45, 15, 31, 46, 16],

	      // 29
	      [7, 146, 116, 7, 147, 117],
	      [21, 73, 45, 7, 74, 46],
	      [1, 53, 23, 37, 54, 24],
	      [19, 45, 15, 26, 46, 16],

	      // 30
	      [5, 145, 115, 10, 146, 116],
	      [19, 75, 47, 10, 76, 48],
	      [15, 54, 24, 25, 55, 25],
	      [23, 45, 15, 25, 46, 16],

	      // 31
	      [13, 145, 115, 3, 146, 116],
	      [2, 74, 46, 29, 75, 47],
	      [42, 54, 24, 1, 55, 25],
	      [23, 45, 15, 28, 46, 16],

	      // 32
	      [17, 145, 115],
	      [10, 74, 46, 23, 75, 47],
	      [10, 54, 24, 35, 55, 25],
	      [19, 45, 15, 35, 46, 16],

	      // 33
	      [17, 145, 115, 1, 146, 116],
	      [14, 74, 46, 21, 75, 47],
	      [29, 54, 24, 19, 55, 25],
	      [11, 45, 15, 46, 46, 16],

	      // 34
	      [13, 145, 115, 6, 146, 116],
	      [14, 74, 46, 23, 75, 47],
	      [44, 54, 24, 7, 55, 25],
	      [59, 46, 16, 1, 47, 17],

	      // 35
	      [12, 151, 121, 7, 152, 122],
	      [12, 75, 47, 26, 76, 48],
	      [39, 54, 24, 14, 55, 25],
	      [22, 45, 15, 41, 46, 16],

	      // 36
	      [6, 151, 121, 14, 152, 122],
	      [6, 75, 47, 34, 76, 48],
	      [46, 54, 24, 10, 55, 25],
	      [2, 45, 15, 64, 46, 16],

	      // 37
	      [17, 152, 122, 4, 153, 123],
	      [29, 74, 46, 14, 75, 47],
	      [49, 54, 24, 10, 55, 25],
	      [24, 45, 15, 46, 46, 16],

	      // 38
	      [4, 152, 122, 18, 153, 123],
	      [13, 74, 46, 32, 75, 47],
	      [48, 54, 24, 14, 55, 25],
	      [42, 45, 15, 32, 46, 16],

	      // 39
	      [20, 147, 117, 4, 148, 118],
	      [40, 75, 47, 7, 76, 48],
	      [43, 54, 24, 22, 55, 25],
	      [10, 45, 15, 67, 46, 16],

	      // 40
	      [19, 148, 118, 6, 149, 119],
	      [18, 75, 47, 31, 76, 48],
	      [34, 54, 24, 34, 55, 25],
	      [20, 45, 15, 61, 46, 16]
	    ];

	    var qrRSBlock = function(totalCount, dataCount) {
	      var _this = {};
	      _this.totalCount = totalCount;
	      _this.dataCount = dataCount;
	      return _this;
	    };

	    var _this = {};

	    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

	      switch(errorCorrectionLevel) {
	      case QRErrorCorrectionLevel.L :
	        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
	      case QRErrorCorrectionLevel.M :
	        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
	      case QRErrorCorrectionLevel.Q :
	        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
	      case QRErrorCorrectionLevel.H :
	        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
	      default :
	        return undefined;
	      }
	    };

	    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

	      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

	      if (typeof rsBlock == 'undefined') {
	        throw 'bad rs block @ typeNumber:' + typeNumber +
	            '/errorCorrectionLevel:' + errorCorrectionLevel;
	      }

	      var length = rsBlock.length / 3;

	      var list = [];

	      for (var i = 0; i < length; i += 1) {

	        var count = rsBlock[i * 3 + 0];
	        var totalCount = rsBlock[i * 3 + 1];
	        var dataCount = rsBlock[i * 3 + 2];

	        for (var j = 0; j < count; j += 1) {
	          list.push(qrRSBlock(totalCount, dataCount) );
	        }
	      }

	      return list;
	    };

	    return _this;
	  }();

	  //---------------------------------------------------------------------
	  // qrBitBuffer
	  //---------------------------------------------------------------------

	  var qrBitBuffer = function() {

	    var _buffer = [];
	    var _length = 0;

	    var _this = {};

	    _this.getBuffer = function() {
	      return _buffer;
	    };

	    _this.getAt = function(index) {
	      var bufIndex = Math.floor(index / 8);
	      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
	    };

	    _this.put = function(num, length) {
	      for (var i = 0; i < length; i += 1) {
	        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
	      }
	    };

	    _this.getLengthInBits = function() {
	      return _length;
	    };

	    _this.putBit = function(bit) {

	      var bufIndex = Math.floor(_length / 8);
	      if (_buffer.length <= bufIndex) {
	        _buffer.push(0);
	      }

	      if (bit) {
	        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
	      }

	      _length += 1;
	    };

	    return _this;
	  };

	  //---------------------------------------------------------------------
	  // qrNumber
	  //---------------------------------------------------------------------

	  var qrNumber = function(data) {

	    var _mode = QRMode.MODE_NUMBER;
	    var _data = data;

	    var _this = {};

	    _this.getMode = function() {
	      return _mode;
	    };

	    _this.getLength = function(buffer) {
	      return _data.length;
	    };

	    _this.write = function(buffer) {

	      var data = _data;

	      var i = 0;

	      while (i + 2 < data.length) {
	        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
	        i += 3;
	      }

	      if (i < data.length) {
	        if (data.length - i == 1) {
	          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
	        } else if (data.length - i == 2) {
	          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
	        }
	      }
	    };

	    var strToNum = function(s) {
	      var num = 0;
	      for (var i = 0; i < s.length; i += 1) {
	        num = num * 10 + chatToNum(s.charAt(i) );
	      }
	      return num;
	    };

	    var chatToNum = function(c) {
	      if ('0' <= c && c <= '9') {
	        return c.charCodeAt(0) - '0'.charCodeAt(0);
	      }
	      throw 'illegal char :' + c;
	    };

	    return _this;
	  };

	  //---------------------------------------------------------------------
	  // qrAlphaNum
	  //---------------------------------------------------------------------

	  var qrAlphaNum = function(data) {

	    var _mode = QRMode.MODE_ALPHA_NUM;
	    var _data = data;

	    var _this = {};

	    _this.getMode = function() {
	      return _mode;
	    };

	    _this.getLength = function(buffer) {
	      return _data.length;
	    };

	    _this.write = function(buffer) {

	      var s = _data;

	      var i = 0;

	      while (i + 1 < s.length) {
	        buffer.put(
	          getCode(s.charAt(i) ) * 45 +
	          getCode(s.charAt(i + 1) ), 11);
	        i += 2;
	      }

	      if (i < s.length) {
	        buffer.put(getCode(s.charAt(i) ), 6);
	      }
	    };

	    var getCode = function(c) {

	      if ('0' <= c && c <= '9') {
	        return c.charCodeAt(0) - '0'.charCodeAt(0);
	      } else if ('A' <= c && c <= 'Z') {
	        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
	      } else {
	        switch (c) {
	        case ' ' : return 36;
	        case '$' : return 37;
	        case '%' : return 38;
	        case '*' : return 39;
	        case '+' : return 40;
	        case '-' : return 41;
	        case '.' : return 42;
	        case '/' : return 43;
	        case ':' : return 44;
	        default :
	          throw 'illegal char :' + c;
	        }
	      }
	    };

	    return _this;
	  };

	  //---------------------------------------------------------------------
	  // qr8BitByte
	  //---------------------------------------------------------------------

	  var qr8BitByte = function(data) {

	    var _mode = QRMode.MODE_8BIT_BYTE;
	    var _bytes = qrcode.stringToBytes(data);

	    var _this = {};

	    _this.getMode = function() {
	      return _mode;
	    };

	    _this.getLength = function(buffer) {
	      return _bytes.length;
	    };

	    _this.write = function(buffer) {
	      for (var i = 0; i < _bytes.length; i += 1) {
	        buffer.put(_bytes[i], 8);
	      }
	    };

	    return _this;
	  };

	  //---------------------------------------------------------------------
	  // qrKanji
	  //---------------------------------------------------------------------

	  var qrKanji = function(data) {

	    var _mode = QRMode.MODE_KANJI;

	    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
	    if (!stringToBytes) {
	      throw 'sjis not supported.';
	    }
	    !function(c, code) {
	      // self test for sjis support.
	      var test = stringToBytes(c);
	      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
	        throw 'sjis not supported.';
	      }
	    }('\u53cb', 0x9746);

	    var _bytes = stringToBytes(data);

	    var _this = {};

	    _this.getMode = function() {
	      return _mode;
	    };

	    _this.getLength = function(buffer) {
	      return ~~(_bytes.length / 2);
	    };

	    _this.write = function(buffer) {

	      var data = _bytes;

	      var i = 0;

	      while (i + 1 < data.length) {

	        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

	        if (0x8140 <= c && c <= 0x9FFC) {
	          c -= 0x8140;
	        } else if (0xE040 <= c && c <= 0xEBBF) {
	          c -= 0xC140;
	        } else {
	          throw 'illegal char at ' + (i + 1) + '/' + c;
	        }

	        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

	        buffer.put(c, 13);

	        i += 2;
	      }

	      if (i < data.length) {
	        throw 'illegal char at ' + (i + 1);
	      }
	    };

	    return _this;
	  };

	  //=====================================================================
	  // GIF Support etc.
	  //

	  //---------------------------------------------------------------------
	  // byteArrayOutputStream
	  //---------------------------------------------------------------------

	  var byteArrayOutputStream = function() {

	    var _bytes = [];

	    var _this = {};

	    _this.writeByte = function(b) {
	      _bytes.push(b & 0xff);
	    };

	    _this.writeShort = function(i) {
	      _this.writeByte(i);
	      _this.writeByte(i >>> 8);
	    };

	    _this.writeBytes = function(b, off, len) {
	      off = off || 0;
	      len = len || b.length;
	      for (var i = 0; i < len; i += 1) {
	        _this.writeByte(b[i + off]);
	      }
	    };

	    _this.writeString = function(s) {
	      for (var i = 0; i < s.length; i += 1) {
	        _this.writeByte(s.charCodeAt(i) );
	      }
	    };

	    _this.toByteArray = function() {
	      return _bytes;
	    };

	    _this.toString = function() {
	      var s = '';
	      s += '[';
	      for (var i = 0; i < _bytes.length; i += 1) {
	        if (i > 0) {
	          s += ',';
	        }
	        s += _bytes[i];
	      }
	      s += ']';
	      return s;
	    };

	    return _this;
	  };

	  //---------------------------------------------------------------------
	  // base64EncodeOutputStream
	  //---------------------------------------------------------------------

	  var base64EncodeOutputStream = function() {

	    var _buffer = 0;
	    var _buflen = 0;
	    var _length = 0;
	    var _base64 = '';

	    var _this = {};

	    var writeEncoded = function(b) {
	      _base64 += String.fromCharCode(encode(b & 0x3f) );
	    };

	    var encode = function(n) {
	      if (n < 0) ; else if (n < 26) {
	        return 0x41 + n;
	      } else if (n < 52) {
	        return 0x61 + (n - 26);
	      } else if (n < 62) {
	        return 0x30 + (n - 52);
	      } else if (n == 62) {
	        return 0x2b;
	      } else if (n == 63) {
	        return 0x2f;
	      }
	      throw 'n:' + n;
	    };

	    _this.writeByte = function(n) {

	      _buffer = (_buffer << 8) | (n & 0xff);
	      _buflen += 8;
	      _length += 1;

	      while (_buflen >= 6) {
	        writeEncoded(_buffer >>> (_buflen - 6) );
	        _buflen -= 6;
	      }
	    };

	    _this.flush = function() {

	      if (_buflen > 0) {
	        writeEncoded(_buffer << (6 - _buflen) );
	        _buffer = 0;
	        _buflen = 0;
	      }

	      if (_length % 3 != 0) {
	        // padding
	        var padlen = 3 - _length % 3;
	        for (var i = 0; i < padlen; i += 1) {
	          _base64 += '=';
	        }
	      }
	    };

	    _this.toString = function() {
	      return _base64;
	    };

	    return _this;
	  };

	  //---------------------------------------------------------------------
	  // base64DecodeInputStream
	  //---------------------------------------------------------------------

	  var base64DecodeInputStream = function(str) {

	    var _str = str;
	    var _pos = 0;
	    var _buffer = 0;
	    var _buflen = 0;

	    var _this = {};

	    _this.read = function() {

	      while (_buflen < 8) {

	        if (_pos >= _str.length) {
	          if (_buflen == 0) {
	            return -1;
	          }
	          throw 'unexpected end of file./' + _buflen;
	        }

	        var c = _str.charAt(_pos);
	        _pos += 1;

	        if (c == '=') {
	          _buflen = 0;
	          return -1;
	        } else if (c.match(/^\s$/) ) {
	          // ignore if whitespace.
	          continue;
	        }

	        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
	        _buflen += 6;
	      }

	      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
	      _buflen -= 8;
	      return n;
	    };

	    var decode = function(c) {
	      if (0x41 <= c && c <= 0x5a) {
	        return c - 0x41;
	      } else if (0x61 <= c && c <= 0x7a) {
	        return c - 0x61 + 26;
	      } else if (0x30 <= c && c <= 0x39) {
	        return c - 0x30 + 52;
	      } else if (c == 0x2b) {
	        return 62;
	      } else if (c == 0x2f) {
	        return 63;
	      } else {
	        throw 'c:' + c;
	      }
	    };

	    return _this;
	  };

	  //---------------------------------------------------------------------
	  // gifImage (B/W)
	  //---------------------------------------------------------------------

	  var gifImage = function(width, height) {

	    var _width = width;
	    var _height = height;
	    var _data = new Array(width * height);

	    var _this = {};

	    _this.setPixel = function(x, y, pixel) {
	      _data[y * _width + x] = pixel;
	    };

	    _this.write = function(out) {

	      //---------------------------------
	      // GIF Signature

	      out.writeString('GIF87a');

	      //---------------------------------
	      // Screen Descriptor

	      out.writeShort(_width);
	      out.writeShort(_height);

	      out.writeByte(0x80); // 2bit
	      out.writeByte(0);
	      out.writeByte(0);

	      //---------------------------------
	      // Global Color Map

	      // black
	      out.writeByte(0x00);
	      out.writeByte(0x00);
	      out.writeByte(0x00);

	      // white
	      out.writeByte(0xff);
	      out.writeByte(0xff);
	      out.writeByte(0xff);

	      //---------------------------------
	      // Image Descriptor

	      out.writeString(',');
	      out.writeShort(0);
	      out.writeShort(0);
	      out.writeShort(_width);
	      out.writeShort(_height);
	      out.writeByte(0);

	      //---------------------------------
	      // Local Color Map

	      //---------------------------------
	      // Raster Data

	      var lzwMinCodeSize = 2;
	      var raster = getLZWRaster(lzwMinCodeSize);

	      out.writeByte(lzwMinCodeSize);

	      var offset = 0;

	      while (raster.length - offset > 255) {
	        out.writeByte(255);
	        out.writeBytes(raster, offset, 255);
	        offset += 255;
	      }

	      out.writeByte(raster.length - offset);
	      out.writeBytes(raster, offset, raster.length - offset);
	      out.writeByte(0x00);

	      //---------------------------------
	      // GIF Terminator
	      out.writeString(';');
	    };

	    var bitOutputStream = function(out) {

	      var _out = out;
	      var _bitLength = 0;
	      var _bitBuffer = 0;

	      var _this = {};

	      _this.write = function(data, length) {

	        if ( (data >>> length) != 0) {
	          throw 'length over';
	        }

	        while (_bitLength + length >= 8) {
	          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
	          length -= (8 - _bitLength);
	          data >>>= (8 - _bitLength);
	          _bitBuffer = 0;
	          _bitLength = 0;
	        }

	        _bitBuffer = (data << _bitLength) | _bitBuffer;
	        _bitLength = _bitLength + length;
	      };

	      _this.flush = function() {
	        if (_bitLength > 0) {
	          _out.writeByte(_bitBuffer);
	        }
	      };

	      return _this;
	    };

	    var getLZWRaster = function(lzwMinCodeSize) {

	      var clearCode = 1 << lzwMinCodeSize;
	      var endCode = (1 << lzwMinCodeSize) + 1;
	      var bitLength = lzwMinCodeSize + 1;

	      // Setup LZWTable
	      var table = lzwTable();

	      for (var i = 0; i < clearCode; i += 1) {
	        table.add(String.fromCharCode(i) );
	      }
	      table.add(String.fromCharCode(clearCode) );
	      table.add(String.fromCharCode(endCode) );

	      var byteOut = byteArrayOutputStream();
	      var bitOut = bitOutputStream(byteOut);

	      // clear code
	      bitOut.write(clearCode, bitLength);

	      var dataIndex = 0;

	      var s = String.fromCharCode(_data[dataIndex]);
	      dataIndex += 1;

	      while (dataIndex < _data.length) {

	        var c = String.fromCharCode(_data[dataIndex]);
	        dataIndex += 1;

	        if (table.contains(s + c) ) {

	          s = s + c;

	        } else {

	          bitOut.write(table.indexOf(s), bitLength);

	          if (table.size() < 0xfff) {

	            if (table.size() == (1 << bitLength) ) {
	              bitLength += 1;
	            }

	            table.add(s + c);
	          }

	          s = c;
	        }
	      }

	      bitOut.write(table.indexOf(s), bitLength);

	      // end code
	      bitOut.write(endCode, bitLength);

	      bitOut.flush();

	      return byteOut.toByteArray();
	    };

	    var lzwTable = function() {

	      var _map = {};
	      var _size = 0;

	      var _this = {};

	      _this.add = function(key) {
	        if (_this.contains(key) ) {
	          throw 'dup key:' + key;
	        }
	        _map[key] = _size;
	        _size += 1;
	      };

	      _this.size = function() {
	        return _size;
	      };

	      _this.indexOf = function(key) {
	        return _map[key];
	      };

	      _this.contains = function(key) {
	        return typeof _map[key] != 'undefined';
	      };

	      return _this;
	    };

	    return _this;
	  };

	  var createDataURL = function(width, height, getPixel) {
	    var gif = gifImage(width, height);
	    for (var y = 0; y < height; y += 1) {
	      for (var x = 0; x < width; x += 1) {
	        gif.setPixel(x, y, getPixel(x, y) );
	      }
	    }

	    var b = byteArrayOutputStream();
	    gif.write(b);

	    var base64 = base64EncodeOutputStream();
	    var bytes = b.toByteArray();
	    for (var i = 0; i < bytes.length; i += 1) {
	      base64.writeByte(bytes[i]);
	    }
	    base64.flush();

	    return 'data:image/gif;base64,' + base64;
	  };

	  //---------------------------------------------------------------------
	  // returns qrcode function.

	  return qrcode;
	}();

	// multibyte support
	!function() {

	  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
	    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
	    function toUTF8Array(str) {
	      var utf8 = [];
	      for (var i=0; i < str.length; i++) {
	        var charcode = str.charCodeAt(i);
	        if (charcode < 0x80) utf8.push(charcode);
	        else if (charcode < 0x800) {
	          utf8.push(0xc0 | (charcode >> 6),
	              0x80 | (charcode & 0x3f));
	        }
	        else if (charcode < 0xd800 || charcode >= 0xe000) {
	          utf8.push(0xe0 | (charcode >> 12),
	              0x80 | ((charcode>>6) & 0x3f),
	              0x80 | (charcode & 0x3f));
	        }
	        // surrogate pair
	        else {
	          i++;
	          // UTF-16 encodes 0x10000-0x10FFFF by
	          // subtracting 0x10000 and splitting the
	          // 20 bits of 0x0-0xFFFFF into two halves
	          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
	            | (str.charCodeAt(i) & 0x3ff));
	          utf8.push(0xf0 | (charcode >>18),
	              0x80 | ((charcode>>12) & 0x3f),
	              0x80 | ((charcode>>6) & 0x3f),
	              0x80 | (charcode & 0x3f));
	        }
	      }
	      return utf8;
	    }
	    return toUTF8Array(s);
	  };

	}();

	(function (factory) {
	  {
	      module.exports = factory();
	  }
	}(function () {
	    return qrcode;
	})); 
} (qrcode$1));

var qrcodeExports = qrcode$1.exports;
var qrcode = /*@__PURE__*/getDefaultExportFromCjs(qrcodeExports);

const getStatus = callable("get_status");
const attach = callable("attach");
const safeDetach = callable("safe_detach");
const setPowerLimit = callable("set_power_limit");
const setCoreOffset = callable("set_core_offset");
const setClockLimit = callable("set_clock_limit");
const xgmFan = callable("xgm_fan");
const xgmLight = callable("xgm_light");
const xgmPower = callable("xgm_power");
const xgmSet = callable("xgm");
const getReleaseNotes = callable("get_release_notes");
// GitHub release notes, as written in RELEASE-NOTES.md: a title line, **Section** labels, "- " bullets, **bold**, [links](…)
const mdInline = (s) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/`([^`]*)`/g, "$1").split(/(\*\*[^*]+\*\*)/)
    .map((p, i) => p.startsWith("**") && p.endsWith("**") ? SP_JSX.jsx("b", { children: p.slice(2, -2) }, i) : p);
const NotesBody = ({ body }) => (SP_JSX.jsx(SP_JSX.Fragment, { children: body.split("\n").map((l, i) => {
        const t = l.trim();
        if (!t)
            return null;
        if (/^[-*] /.test(t))
            return SP_JSX.jsxs("div", { style: { display: "flex", gap: "6px", margin: "3px 0" }, children: [SP_JSX.jsx("span", { children: "\u2022" }), SP_JSX.jsx("span", { children: mdInline(t.slice(2)) })] }, i);
        if (/^\*\*[^*]+\*\*/.test(t))
            return SP_JSX.jsx("div", { style: { marginTop: "8px", fontWeight: 700 }, children: mdInline(t) }, i);
        return SP_JSX.jsx("div", { style: { margin: "3px 0" }, children: mdInline(t) }, i);
    }) }));
// "What's new": loaded from GitHub when opened (what an update brings, or the installed version's notes)
function ReleaseNotes({ label }) {
    const [n, setN] = SP_REACT.useState(null);
    const [open, setOpen] = SP_REACT.useState(false);
    const toggle = () => { setOpen(!open); if (!open && !n)
        getReleaseNotes().then(setN).catch((e) => setN({ title: "Release notes", notes: [], error: `${e}` })); };
    return (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: toggle, children: open ? "Hide release notes" : label }) }), open && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", lineHeight: 1.4 }, children: !n ? "Loading the release notes from GitHub…" : n.error ? n.error : !n.notes.length ? "No release notes found." : (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx("div", { style: { fontWeight: 700, fontSize: "13px", marginBottom: "4px" }, children: n.title }), n.notes.map((r) => SP_JSX.jsxs("div", { style: { marginBottom: "12px" }, children: [SP_JSX.jsxs("div", { style: { opacity: 0.7 }, children: [r.version, " \u00B7 ", r.date] }), SP_JSX.jsx(NotesBody, { body: r.body })] }, r.version))] })) }) })] }));
}
const xgmIntro = callable("xgm_intro"); // the XG Mobile intro animation (data URI, or "" once shown)
const xgmIntroDone = callable("xgm_intro_done"); // light-effect, brightness, offset
const XGM_COLORS = [["ff0000", "Red"], ["ff6000", "Orange"], ["ffd000", "Yellow"], ["00ff40", "Green"], ["00e0ff", "Cyan"], ["0040ff", "Blue"], ["a000ff", "Purple"], ["ffffff", "White"]];
const resetClocks = callable("reset_clocks");
const getSetup = callable("get_setup_status");
const acceptUntested = callable("accept_untested");
const installSystem = callable("install_system");
const uninstallSystem = callable("uninstall_system");
const rebootSystem = callable("reboot_system");
const restartGamemode = callable("restart_gamemode");
const getUpdate = callable("get_update_status");
const setAutoUpdate = callable("set_auto_update");
const checkUpdate = callable("check_update");
const updateDetached = callable("update_detached");
const pluginUpdateInfo = callable("plugin_update_info");
// Update through Decky's own installer, as its plugin store does: the plugin is swapped in place and Steam keeps running.
// (Restarting Decky, the old way and still the fallback, reloads Steam's whole interface.) Decky asks "Update?" itself,
// so EGPU Buddy does not ask first: one confirmation.
async function updateInPlace(version) {
    const be = window.DeckyBackend;
    const info = await pluginUpdateInfo(version);
    if (!info.url || !be?.call)
        return checkUpdate(true);
    try {
        await be.call("utilities/install_plugin", info.url, "EGPU Buddy", version, info.hash, 2);
    }
    catch {
        return checkUpdate(true);
    }
    return { ok: true, message: `Confirm in Decky's prompt: the plugin updates in place to ${version}, then its system files install (no restart).` };
}
const popNotice = callable("pop_notice");
const getTrial = callable("get_driver_trial");
const startTrial = callable("start_driver_trial");
const revertTrial = callable("revert_driver_trial");
const ackTrial = callable("ack_driver_trial");
const getScreens = callable("get_screens");
const wakeScreens = callable("wake_screens");
const getScreenOffer = callable("get_screen_offer");
const setGameScreen = callable("set_game_screen");
const getTvControl = callable("get_tv_control");
const getAddons = callable("get_addons");
const setAddon = callable("set_addon");
const getUsb4 = callable("get_usb4");
const makeReport = callable("make_report");
// a QR code as an SVG (scanned with a phone, it opens the GitHub issue form with the report summary filled in)
const qrSvg = (text) => { const q = qrcode(0, "L"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 3, margin: 3, scalable: true }); };
const setTvControl = callable("set_tv_control");
const pairTv = callable("pair_tv");
const getGameRes = callable("get_game_res");
// Steam's own screen mode for the screen Game Mode is on: its native mode at the highest refresh rate. Native = the mode
// that moves the most pixels per second: a monitor also lists bigger modes it only downscales (a 5120x1440 ultrawide
// offers 3840x2160 at 60 Hz), so "most pixels" picked a mode the panel cannot show natively.
// Without a chosen mode Steam renders big external screens at 1920x1080 (XR glasses in ultrawide stayed 16:9). Steam's
// DisplayManager speaks protobuf; only the few fields needed are read and written (layout from Steam's own client code).
const pbFields = (buf) => {
    let i = 0;
    const out = [];
    const vi = () => { let r = 0, s = 0, b; do {
        b = buf[i++];
        r += (b & 0x7f) * 2 ** s;
        s += 7;
    } while (b & 0x80 && i < buf.length); return r; };
    while (i < buf.length) {
        const t = vi(), f = Math.floor(t / 8), w = t & 7;
        if (w === 0)
            out.push([f, vi()]);
        else if (w === 2) {
            const l = vi();
            out.push([f, buf.subarray(i, i + l)]);
            i += l;
        }
        else if (w === 5)
            i += 4;
        else if (w === 1)
            i += 8;
        else
            break;
    }
    return out;
};
const pbGet = (fs, n) => fs.filter(([f]) => f === n).map(([, v]) => v);
const modeTried = new Set(); // one attempt per screen and mode: Game Mode may run a requested mode as another one
async function applyBestScreenModes() {
    const dm = window.SteamClient?.System?.DisplayManager;
    if (!dm?.GetState || !dm?.SetMode)
        return;
    const cfg = await getGameRes();
    if (!cfg.enabled || cfg.skip_mode)
        return;
    const r = await dm.GetState();
    if (!r?.reply)
        return;
    for (const raw of pbGet(pbFields(new Uint8Array(r.reply)), 1)) {
        const f = pbFields(raw), modes = pbGet(f, 11).map((m) => {
            const g = pbFields(m);
            const w = pbGet(g, 2)[0] ?? 0, h = pbGet(g, 3)[0] ?? 0, hz = pbGet(g, 4)[0] ?? 0;
            return { id: pbGet(g, 1)[0] ?? 0, key: `${w}x${h}@${hz}`, area: w * h, rate: w * h * hz, hz };
        });
        if (pbGet(f, 6)[0] || !pbGet(f, 5)[0] || !modes.length)
            continue; // the built-in screen is Steam's own business
        const best = modes.sort((a, b) => b.rate - a.rate || b.area - a.area)[0];
        if (pbGet(f, 7)[0] && pbGet(f, 10)[0] === best.id)
            continue; // already on it
        // a mode set changes the display state, which calls this again: never ask twice (it looped when Game Mode ran the
        // requested mode as a slightly different one)
        const tried = `${new TextDecoder().decode(pbGet(f, 3)[0] ?? new Uint8Array())}|${best.key}`;
        if (modeTried.has(tried))
            continue;
        modeTried.add(tried);
        const bytes = [];
        const wv = (v) => { while (v > 127) {
            bytes.push((v & 127) | 128);
            v = Math.floor(v / 128);
        } bytes.push(v); };
        wv(8);
        wv(pbGet(f, 1)[0] ?? 0);
        wv(16);
        wv(best.id);
        wv(24);
        wv(pbGet(f, 19)[0] ?? 0);
        await dm.SetMode(btoa(String.fromCharCode(...bytes)));
    }
}
const setGameRes = callable("set_game_res");
const gameResFor = callable("game_res_for");
const gameResSync = callable("game_res_sync");
// a screen plugged into the eGPU while Game Mode runs on another one: offer to move (one screen at a time)
const maybeOfferScreen = async () => {
    const o = await getScreenOffer();
    if (!o.connector)
        return;
    // XR glasses: their picture and what passthrough means; any other screen: the plain question as before
    const big = () => SP_JSX.jsx("div", { style: { display: "flex", justifyContent: "center", margin: "4px 0 14px" }, children: SP_JSX.jsx(Pic, { ...glassesPhoto(o.brand, o.name), width: 300 }) });
    const ask = o.game ? `Close the running game first, then use "Show Game Mode on ${o.name}" in EGPU Buddy.`
        : `Game Mode restarts on it (the screen goes dark for a few seconds). You can switch back from EGPU Buddy.`;
    DFL.showModal(SP_JSX.jsx(DFL.ConfirmModal, { strTitle: `${o.name} connected`, strDescription: o.xr ? SP_JSX.jsxs("div", { children: [big(), SP_JSX.jsxs("div", { children: [SP_JSX.jsx("b", { children: "XR glasses passthrough." }), " Play your eGPU games in the glasses: the eGPU keeps rendering, the handheld sends the picture to the glasses (", modeText(o.detail ?? ""), ") and the sound moves to the glasses' speakers. No HDMI-to-USB-C adapter on the eGPU needed."] }), SP_JSX.jsx("div", { style: { opacity: 0.7, marginTop: "10px" }, children: ask })] })
            : o.game ? ask : `${o.detail}\n\nShow Game Mode on ${o.name}? ${ask}`, strOKButtonText: o.game ? "OK" : o.xr ? "Show in the glasses" : "Switch", strCancelButtonText: "Stay here", onOK: async () => {
            if (o.game)
                return;
            const r = await setGameScreen(o.connector);
            toaster.toast({ title: "EGPU Buddy", body: r.message });
        } }));
};
const ICONS = {
    display: `<svg viewBox="0 0 120 48" width="96" height="38" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="28" y="4" width="64" height="34" rx="3"/><path d="M52 44 H68 M60 38 V44"/></svg>`,
    handheld: `<svg viewBox="0 0 120 48" width="96" height="38" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="16" y="6" width="88" height="36" rx="9"/><rect x="34" y="11" width="52" height="26" rx="2"/><circle cx="25" cy="18" r="3"/><circle cx="95" cy="30" r="3"/></svg>`,
};
// front view used for every pair of XR glasses in the screen list (picture supplied by the project author)
const XR_FRONT = "data:image/webp;base64,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";
const glassesIcon = (_brand) => ICONS.display; // glasses without a picture: a plain screen
// The glasses' own product picture for the plug-in pop-up, from the maker's shop, loaded when shown (not shipped in the
// plugin); glasses without one, or offline, show XR_FRONT. white: the picture has a white background, cut out below.
const SHOP = "https://cdn.shopify.com/s/files/1/";
const XR_PHOTOS = [
    [/viture.*luma/i, "0762/8760/7065/files/nav-glasses-luma-series.png"],
    [/viture.*pro/i, "0762/8760/7065/files/nav-glasses-viture-pro-2.png"],
    [/viture/i, "0762/8760/7065/files/nav-glasses-the-beast.png"],
    [/rog/i, "0832/4671/1067/files/XREAL_ROG___2400x2400_09.jpg", true],
    [/xreal|nreal/i, "0832/4671/1067/files/R-6V-N-Gina-04.png"],
    [/rayneo|tcl|nxtwear/i, "0688/8642/9983/files/PP1-air_4_pro_e44fd4cd-68af-4ebc-8314-2a86c80eec11.png", false, true], // crop: the shop logo above
    [/rokid/i, "0628/5636/4211/files/001_3d8988bd-fbc0-4eb7-be8b-e63bf17b612f.jpg", true],
];
const glassesPhoto = (brand, model) => {
    const m = XR_PHOTOS.find(([re]) => re.test(`${brand ?? ""} ${model ?? ""}`));
    return m ? { url: `${SHOP}${m[1]}?width=600`, white: !!m[2], crop: !!m[3] } : { url: XR_FRONT, white: false, crop: false };
};
// White around the glasses -> transparent: flood fill from the picture's edges over near-white, so a white-background
// picture sits on the dark pop-up like the others (white inside the glasses, e.g. reflections, is not reached).
const cutWhite = (url) => new Promise((ok, fail) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = fail;
    img.onload = () => {
        const c = document.createElement("canvas"), W = c.width = img.naturalWidth, H = c.height = img.naturalHeight;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, W, H), p = d.data, seen = new Uint8Array(W * H), st = [];
        const lo = (k) => Math.min(p[k * 4], p[k * 4 + 1], p[k * 4 + 2]);
        const bg = (k) => lo(k) > 205 && Math.max(p[k * 4], p[k * 4 + 1], p[k * 4 + 2]) - lo(k) < 20;
        // edge pixels are part white: fade them and take the white back out of their colour, so no light halo is left
        const clear = (k) => {
            const a = Math.max(0, Math.min(255, (247 - lo(k)) * 8));
            p[k * 4 + 3] = a;
            if (a > 0 && a < 255)
                for (let i = 0; i < 3; i++)
                    p[k * 4 + i] = Math.max(0, Math.round((p[k * 4 + i] - 255 * (1 - a / 255)) / (a / 255)));
        };
        for (let x = 0; x < W; x++)
            st.push(x, (H - 1) * W + x);
        for (let y = 0; y < H; y++)
            st.push(y * W, y * W + W - 1);
        while (st.length) {
            const k = st.pop();
            if (seen[k] || !bg(k))
                continue;
            seen[k] = 1;
            clear(k);
            const x = k % W;
            if (x > 0)
                st.push(k - 1);
            if (x < W - 1)
                st.push(k + 1);
            if (k >= W)
                st.push(k - W);
            if (k < W * (H - 1))
                st.push(k + W);
        }
        // background showing through gaps in the frame (between the arms, above the lenses): enclosed pure-white areas
        // too, when bigger than a highlight
        const pure = (k) => lo(k) > 240 && Math.max(p[k * 4], p[k * 4 + 1], p[k * 4 + 2]) - lo(k) < 12;
        for (let k0 = 0; k0 < W * H; k0++) {
            if (seen[k0] || !pure(k0))
                continue;
            const area = [], q = [k0];
            seen[k0] = 2;
            while (q.length) {
                const k = q.pop();
                area.push(k);
                const x = k % W;
                for (const n of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W])
                    if (n >= 0 && n < W * H && !seen[n] && bg(n)) {
                        seen[n] = 2;
                        q.push(n);
                    }
            }
            if (area.length > W * H / 2000)
                for (const k of area)
                    clear(k);
        }
        // the outermost 2 px of the glasses are still a light grey blend with the white: fade those by how light they are
        for (let pass = 0; pass < 2; pass++) {
            const rim = [];
            for (let k = W; k < W * (H - 1); k++) {
                const x = k % W;
                if (x === 0 || x === W - 1 || p[k * 4 + 3] < 255 || lo(k) < 120)
                    continue;
                if (p[(k - 1) * 4 + 3] < 128 || p[(k + 1) * 4 + 3] < 128 || p[(k - W) * 4 + 3] < 128 || p[(k + W) * 4 + 3] < 128)
                    rim.push(k);
            }
            for (const k of rim) {
                const a = Math.max(0, Math.min(255, Math.round((250 - lo(k)) * 2)));
                p[k * 4 + 3] = a;
                if (a > 0 && a < 255)
                    for (let i = 0; i < 3; i++)
                        p[k * 4 + i] = Math.max(0, Math.round((p[k * 4 + i] - 255 * (1 - a / 255)) / (a / 255)));
            }
        }
        g.putImageData(d, 0, 0);
        ok(c.toDataURL("image/png"));
    };
    img.src = url;
});
const Pic = ({ url, white, crop, width }) => {
    const [src, setSrc] = SP_REACT.useState(white ? "" : url);
    SP_REACT.useEffect(() => { if (white)
        cutWhite(url).then(setSrc, () => setSrc(XR_FRONT)); }, [url, white]);
    const own = src !== XR_FRONT;
    return SP_JSX.jsx("img", { src: src || undefined, onError: () => setSrc(XR_FRONT), style: { width: `${width}px`, height: "auto", display: "block", minHeight: src ? undefined : "180px",
            ...(own && crop ? { aspectRatio: "4 / 3", objectFit: "cover", objectPosition: "50% 85%" } : {}),
            ...(own && url !== XR_FRONT ? { filter: "drop-shadow(0 0 14px rgba(150,180,255,0.22))" } : {}) } }); // a soft glow keeps dark glasses visible on the dark pop-up
};
// "3840x1200 @ 60 Hz" -> "Ultrawide 32:9 · 3840x1200 @ 60 Hz" when the screen is that wide (glasses switched to ultrawide)
const modeText = (detail) => {
    const m = detail.match(/(\d+)x(\d+) @ \d+ Hz/);
    if (!m)
        return "";
    return (Number(m[1]) / Number(m[2]) >= 3 ? "Ultrawide 32:9 · " : "") + m[0];
};
// every screen Game Mode can go to while the eGPU is attached: the handheld itself, screens on its USB-C (XR glasses),
// and the eGPU's monitors/TVs (an off TV only when TV control can switch it on)
const screenTargets = (s, tvWakes) => [
    { name: "eDP-1", label: "the handheld screen", detail: "Games still run on the eGPU", icon: ICONS.handheld, xr: false },
    ...(s.handheld_displays ?? []).map((d) => ({ name: d.name, label: d.model || d.name, xr: !!d.xr, icon: d.xr ? glassesIcon() : ICONS.display, photo: d.xr ? XR_FRONT : "",
        detail: `${d.xr ? "XR glasses passthrough" : "External display on the handheld's USB-C"} · ${modeText(d.detail)} · games run on the eGPU` })),
    ...s.displays.filter((d) => d.state !== "off" || tvWakes).map((d) => ({ name: d.name, label: d.model || d.name, xr: false, icon: ICONS.display,
        detail: d.state === "off" ? "Off: choosing it turns it on" : d.detail })),
];
const screenState = { "in-use": "on", "other-input": "other input", standby: "asleep", off: "off" };
const vt = (v) => (v.match(/\d+/g) ?? ["0"]).slice(0, 3).reduce((a, x) => a * 1000 + Number(x), 0);
const PLUGIN_VERSION = "0.7.138";
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
// The percentage follows real stages (and real compile output); the running clock shows it is alive between stage changes.
const Progress = ({ pct, title, step, started, expect }) => (SP_JSX.jsxs("div", { style: { width: "100%", boxSizing: "border-box", padding: "4px 0" }, children: [SP_JSX.jsxs("div", { style: { display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }, children: [SP_JSX.jsx("span", { children: title }), SP_JSX.jsxs("span", { children: [Math.round(pct), "%"] })] }), SP_JSX.jsx("div", { style: { width: "100%", height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.15)", overflow: "hidden" }, children: SP_JSX.jsx("div", { style: { width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: "#1a9fff", transition: "width .4s" } }) }), SP_JSX.jsx("div", { style: { fontSize: "12px", marginTop: "4px", whiteSpace: "normal" }, children: step }), SP_JSX.jsxs("div", { style: { fontSize: "11px", opacity: 0.75, marginTop: "2px", whiteSpace: "normal" }, children: [started ? `${mmss(Date.now() / 1000 - started)} elapsed` : "", expect ? ` · usually ${expect}` : ""] }), SP_JSX.jsx("div", { style: { fontSize: "11px", opacity: 0.75, marginTop: "2px", whiteSpace: "normal" }, children: "You can close this menu: it continues, and a notification appears when it is done." })] }));
// one line per row: values are kept short below, and anything still too long for a narrow screen ends in "…" instead of
// breaking mid-word onto a second line ("RTX 5 / 060 Ti", seen on a 5120x1440 monitor and on the handheld panel)
const Row = ({ k, v }) => (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.Field, { label: k, focusable: false, bottomSeparator: "none", children: SP_JSX.jsx("span", { style: { fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block", maxWidth: "100%" }, children: v || "—" }) }) }));
// the screen's own name ("X49 V") instead of its connector ("DP-7") where the EDID gives one
const screenName = (s) => s.output.startsWith("eDP") ? "the handheld screen" : [...s.displays, ...(s.handheld_displays ?? [])].find((d) => d.name === s.output)?.model || s.output;
const gpuName = (n) => (n ?? "").replace(/^NVIDIA\s+(GeForce\s+)?/i, "");
// "alsa_output.pci-0000_03_00.1.HiFi__HDMI1__sink" -> "eGPU HDMI 1"; the built-in card -> "Built-in"
const audioName = (sink, bdf) => {
    if (!sink)
        return "";
    const port = sink.match(/(HDMI|DP)(\d*)/i);
    const busDev = bdf.replace(/^0000:/, "").replace(/\.\d$/, "").replace(":", "_");
    if (busDev && sink.includes(busDev))
        return `eGPU${port ? ` ${port[1].toUpperCase()}${port[2] ? " " + port[2] : ""}` : ""}`;
    if (/bluez/i.test(sink))
        return "Bluetooth";
    if (/usb/i.test(sink))
        return "USB audio";
    if (/pro-output|analog|speaker/i.test(sink))
        return "Built-in";
    return sink.replace(/^alsa_output\.(pci-0000_)?/, "").replace(/\.(pro-output-0|.*__sink)$/, "");
};
function stateLine(s) {
    if (!s.present)
        return s.driver_loaded ? "eGPU off the bus (driver still loaded)" : "No eGPU attached";
    if (s.game_mode)
        return s.on_egpu ? `Attached — Game Mode on ${screenName(s)}` : s.egpu_handheld ? `Attached — Game Mode on ${screenName(s)}, games on the eGPU` : "eGPU present — Game Mode on the handheld screen";
    return "eGPU present (Desktop)";
}
// Beta driver trial: a progress screen that opens by itself whenever Game Mode starts while a trial runs (it restarts
// twice: onto the handheld at the Safe Detach, onto the monitor at the attach), and once more with the result.
let trialOpen = false;
function TrialModal({ closeModal }) {
    const [t, setT] = SP_REACT.useState(null);
    SP_REACT.useEffect(() => {
        let alive = true;
        const tick = async () => { try {
            const x = await getTrial();
            if (alive)
                setT(x);
        }
        catch { /* backend restarting */ } };
        tick();
        const i = setInterval(tick, 1000);
        return () => { alive = false; clearInterval(i); };
    }, []);
    const done = !!t && !t.running;
    const back = !!t && (t.state === "reverting" || t.state === "reverted");
    const close = () => { trialOpen = false; if (done)
        ackTrial(); closeModal?.(); };
    return (SP_JSX.jsx(DFL.ConfirmModal, { strTitle: !t ? "Beta driver" : done ? (t.state === "kept" ? `Beta driver ${t.beta} installed` : t.state === "reverted" ? `Back on the tested driver ${t.tested}` : "Beta driver trial failed") : back ? `Returning to the tested driver ${t.tested}` : `Installing beta driver ${t.beta}`, strDescription: !t ? "…" : done
            ? SP_JSX.jsx("div", { style: { fontSize: "14px", color: t.state === "kept" ? "#4caf50" : t.state === "failed" ? "#ff6b6b" : "#f0b429" }, children: t.message })
            : SP_JSX.jsx(Progress, { pct: t.progress, title: back ? "Reverting" : "Installing", step: t.step, started: t.started, expect: back ? "3-5 minutes" : "5-20 minutes" }), bAlertDialog: true, strOKButtonText: done ? "OK" : "Working… (B hides this)", bOKDisabled: !done, onOK: close, onCancel: close, closeModal: close }));
}
const maybeShowTrial = async () => {
    if (trialOpen)
        return;
    const t = await getTrial();
    const recent = t.started && Date.now() / 1000 - t.started < 7200;
    if (recent && (t.running || (["kept", "reverted", "failed"].includes(t.state) && !t.acked))) {
        trialOpen = true;
        DFL.showModal(SP_JSX.jsx(TrialModal, {}));
    }
};
function Content() {
    const visible = useQuickAccessVisible();
    const [tab, setTab] = SP_REACT.useState("main");
    const [logOpen, setLogOpen] = SP_REACT.useState(""); // logs stay folded away unless asked for
    const [su, setSu] = SP_REACT.useState(null);
    const [up, setUp] = SP_REACT.useState(null);
    const [tv, setTv] = SP_REACT.useState(null);
    const [ad, setAd] = SP_REACT.useState(null);
    const [usb4, setUsb4] = SP_REACT.useState({});
    const [report, setReport] = SP_REACT.useState(null);
    const [gr, setGr] = SP_REACT.useState(null);
    const [tr, setTr] = SP_REACT.useState(null);
    const staleChecked = SP_REACT.useRef(false);
    const [confirmSetup, setConfirmSetup] = SP_REACT.useState("");
    const [s, setS] = SP_REACT.useState(null);
    const [scr, setScr] = SP_REACT.useState(null);
    const [msg, setMsg] = SP_REACT.useState("");
    const [busy, setBusy] = SP_REACT.useState(false);
    const [pl, setPl] = SP_REACT.useState(null);
    const [off, setOff] = SP_REACT.useState(0);
    const [clk, setClk] = SP_REACT.useState(null);
    const [pt, setPt] = SP_REACT.useState(null); // ASUS XG Mobile power target (W)
    const [xoff, setXoff] = SP_REACT.useState(null);
    const [intro, setIntro] = SP_REACT.useState(null); // XG Mobile intro, once
    const introAsked = SP_REACT.useRef(false); // ASUS XG Mobile core / memory clock offsets (MHz)   // laptop-class GPUs: a GPU clock limit is their power control
    const refresh = async () => {
        try {
            setS(await getStatus());
            setSu(await getSetup());
            const u = await getUpdate();
            setUp(u);
            setTv(await getTvControl());
            const a = await getAddons();
            setAd(a);
            setUsb4(a.usb4 ? await getUsb4() : {});
            setGr(await getGameRes());
            setTr(await getTrial());
            // the hourly check only counts awake time: after a night of sleep the status is stale, so re-check on open (wall clock)
            if (!staleChecked.current && (!u.checked || Date.now() / 1000 - u.checked > 600)) {
                staleChecked.current = true;
                checkUpdate(false);
            }
        }
        catch (e) {
            setMsg(`status error: ${e}`);
        }
    };
    // DDC/CI reads are slow-ish and some screens dislike polling: read once when details open
    SP_REACT.useEffect(() => { if (visible && tab === "details")
        getScreens().then(setScr).catch(() => setScr(null)); }, [visible, tab]);
    SP_REACT.useEffect(() => { if (!visible)
        return; refresh(); const t = setInterval(refresh, su?.busy ? 1000 : 3000); return () => clearInterval(t); }, [visible, su?.busy]);
    const gameUp = !!(s?.game_running || DFL.Router.MainRunningApp);
    const run = async (fn) => { setBusy(true); try {
        const r = await fn();
        setMsg(r.message);
    }
    catch (e) {
        setMsg(`${e}`);
    }
    finally {
        setBusy(false);
        refresh();
    } };
    const tel = s?.telemetry ?? {};
    const plMin = Number(tel["power.min_limit"] ?? 100), plMax = Number(tel["power.max_limit"] ?? 320);
    const plNow = pl ?? Math.round(Number(tel["power.limit"] ?? plMax));
    // laptop-class GPUs (ASUS XG Mobile) report the limits as [N/A]: the dock firmware owns the power, nvidia-smi -pl cannot set it
    const plOk = [plMin, plMax, plNow].every(Number.isFinite) && plMax > plMin;
    // ASUS XG Mobile: the cap the GPU really runs at (enforced.power.limit, queried only for it) where power.limit is [N/A]
    const xg = !!s?.dock?.includes("XG Mobile");
    const xgCap = xg && !Number.isFinite(Number(tel["power.limit"])) && Number.isFinite(Number(tel["enforced.power.limit"])) ? Math.round(Number(tel["enforced.power.limit"])) : null;
    // laptop-class GPUs: the clock limit spans 600 MHz to the GPU's own maximum (clocks.max.graphics)
    const clkMax = Math.round(Number(tel["clocks.max.graphics"]) || 0), clkMin = Math.min(600, clkMax);
    // ASUS XG Mobile: power target 40 W to its cap (at the cap = no target), fan mode and lights through egpu-xgm
    const xgTop = Math.round(Number(tel["enforced.power.limit"])) || 115;
    const xgLive = s?.xgm?.live ?? {};
    const ptNow = pt ?? (s?.xgm?.power_target || xgTop);
    const xoffNow = xoff ?? [s?.xgm?.offset?.[0] ?? 0, s?.xgm?.offset?.[1] ?? 0];
    const lightOn = s?.xgm?.light !== false;
    // the XG Mobile intro: the first time the plugin shows the XG Mobile controls, once. Marked shown only when it has played
    // to the end or was tapped away, so closing the panel early shows it again next time
    const introTimer = SP_REACT.useRef(null);
    const endIntro = () => {
        if (introTimer.current)
            clearTimeout(introTimer.current);
        introTimer.current = null;
        setIntro((i) => i && { ...i, fading: true });
        xgmIntroDone().catch(() => { });
        setTimeout(() => setIntro(null), 600);
    };
    SP_REACT.useEffect(() => {
        if (!visible) { // the panel closed before the intro ended: not counted, it plays again the next time
            if (introTimer.current) {
                clearTimeout(introTimer.current);
                introTimer.current = null;
                introAsked.current = false;
                setIntro(null);
            }
            return;
        }
        if (introAsked.current || !s?.present || !s.driver_loaded || !s.dock?.includes("XG Mobile") || !s.xgm || s.xgm.intro_seen_plugin)
            return;
        introAsked.current = true;
        // a distinct URL per play (a media type parameter): Chromium shares one animation timeline per image URL, so a
        // repeat after the panel was closed would start mid-way. Plain data: URLs, like the plugin's other pictures
        xgmIntro().then((d) => {
            if (d) {
                setIntro({ src: d.replace("data:image/webp;", `data:image/webp;play=${Date.now()};`), fading: false });
                introTimer.current = setTimeout(endIntro, 7100);
            }
        }).catch(() => { });
    }, [s, visible]);
    const lightFx = (fx, rgb, speed) => run(() => xgmSet("light-effect", `${fx || s?.xgm?.effect || "static"}:${rgb || s?.xgm?.color || "ff0000"}:${speed || s?.xgm?.speed || "normal"}`));
    const clkNow = clk ?? (Math.round(Number(tel["clock_limit"])) || clkMax); // the applied limit (kept by the helper), else none
    const controlsOk = !!(s?.present && s?.driver_loaded && s?.on_egpu);
    // "mounted" for uninstall purposes: the driver is loaded, so /usr cannot be written and the
    // extension cannot be unmerged. Detaching is what clears it.
    const egpuMounted = !!(s?.driver_loaded);
    const tvWakes = !!tv?.enabled && !!tv?.paired.length; // TV control can switch a TV that is off on
    const askUninstall = () => DFL.showModal(SP_JSX.jsx(DFL.ConfirmModal, { strTitle: "Uninstall EGPU Buddy?", bDestructiveWarning: true, strOKButtonText: "Uninstall", strDescription: (egpuMounted ? "The eGPU is safely detached first: Game Mode moves to the handheld screen for a few seconds. " : "") + "Then the system integration is removed and the machine goes back to how it was.", onOK: () => run(uninstallSystem) }));
    const WHAT = "Installs the hot-plug scripts, the Game Mode session, the GBM gamescope, the boot policy, the desktop app, the patched hot-unplug driver with the NVIDIA userspace pinned to it, and the kernel parameters. Backups are kept.";
    const confirmInstall = (title, go, detachGo) => {
        const needAccept = !!(su?.untested && !su.accepted_untested);
        if (detachGo && up?.needs_detach && !needAccept) { // SteamOS with the eGPU in use: the update cannot be written until it is detached
            DFL.showModal(SP_JSX.jsx(DFL.ConfirmModal, { strTitle: `${title}: the eGPU is in use`, strOKButtonText: "Detach and update", bDestructiveWarning: true, strDescription: "The eGPU is detached first: Game Mode moves to the handheld screen and the monitor loses signal. Leave the cable plugged in. Then the update installs" + (su?.slow_build ? " (a driver rebuild can take 10-20 minutes; keep the charger connected)" : "") + ". When it is done the eGPU is attached again by itself and Game Mode returns to its screen. A notification tells you each step.", onOK: () => run(detachGo) }));
            return;
        }
        const time = ` Expected time: ${su?.expect ?? "several minutes"}.` + (su?.slow_build ? " The driver is built on /home; the system partition is not touched. Keep the charger connected and the eGPU unplugged." : "") + " You can close the menu meanwhile; a notification appears when it is done.";
        const disclaimer = needAccept ? `NOT TESTED ON THIS HARDWARE: ${su.untested.split("\n").join("; ")}. This project was verified on one machine only (Legion Go 2, RTX 5060 Ti, CachyOS). Here it may not work, may leave the screen dark, or may need a reboot to recover. You install and test it at your own risk.\n\n` : "";
        DFL.showModal(SP_JSX.jsx(DFL.ConfirmModal, { strTitle: needAccept ? `${title} (untested hardware)` : title, strDescription: disclaimer + WHAT + time, strOKButtonText: needAccept ? "I accept the risk" : "Continue", onOK: () => run(async () => { if (needAccept)
                await acceptUntested(); return go(); }) }));
    };
    // setup state comes from the SYSTEM, not from the last run: it is the same after closing the menu, a Decky restart or a reboot
    const driverMissing = !!(su?.slow_build && su.installed_version && su.helpers_present && su.driver_ready === false && !su.driver_building);
    const behind = !!(su?.installed_version && vt(su.installed_version) < vt(su.payload_version));
    const needsInstall = !!(su && !su.unsupported && (!su.helpers_present || !su.installed_version || behind || (!!su.cmdline_missing && !su.cmdline_pending) || driverMissing));
    // offered whenever a newer release exists and setup is complete, including half way through an earlier update (plugin
    // newer than its system files): hiding it there left users with no way forward
    const updateReady = !!(up?.available && vt(up.available) > vt(PLUGIN_VERSION) && (!needsInstall || (behind && !!su?.helpers_present)));
    const installClick = () => confirmInstall(su?.installed_version ? "Update the system files" : "Install", () => installSystem(false), su?.installed_version ? () => updateDetached("") : undefined);
    // An AMD or Intel eGPU needs neither the patched nvidia-open build (the long part of an install)
    // nor the GBM-scanout gamescope (that exists only to fix the NVIDIA scan-out corruption).
    // Everything else - hot-plug attach, safe detach, cable-pull recovery, the session fallback,
    // audio follow - is vendor-neutral and is still installed.
    return (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsxs(DFL.PanelSection, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => setTab(tab === "main" ? "details" : "main"), children: tab === "main" ? "Show details" : "Back to main" }) }), tab !== "setup" && (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => setTab("setup"), children: "Setup & updates" }) }))] }), tab === "main" && (SP_JSX.jsxs(DFL.PanelSection, { title: "eGPU", children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { className: DFL.staticClasses.Text, children: s ? stateLine(s) : "Loading…" }) }), su?.unsupported && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", color: "#ff6b6b" }, children: su.unsupported }) }), su?.driver_building && !su.busy && (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.8 }, children: su.driver_building.includes("prebuild") ? "A SteamOS update is ready: EGPU Buddy is preparing the eGPU driver for it. Restart once it says it is done." : "SteamOS changed the kernel: EGPU Buddy is building the eGPU driver for it in the background (a few minutes). The eGPU works again by itself when it is done; nothing to install." }) })), needsInstall && su && !su.busy && su.rc !== 0 && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.8 }, children: su.installed_version && !su.helpers_present ? "System files are missing (OS update)." : behind ? `Plugin ${su.payload_version} is in; its system files finish installing by themselves (after any running game is closed), or press Update system integration.` : driverMissing ? "The NVIDIA driver is not installed. Keep the eGPU unplugged." : su.installed_version ? "Setup is incomplete." : "Not installed yet." }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy, onClick: () => installClick(), children: behind && su.helpers_present ? "Update system integration" : su.installed_version ? "Repair system integration" : "Install system integration" }) })] })), updateReady && !su?.busy && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { fontSize: "12px", opacity: 0.8 }, children: ["Version ", up.available, " is available."] }) }), updateReady && !su?.busy && SP_JSX.jsx(ReleaseNotes, { label: `What's new in ${up.available}` }), updateReady && !su?.busy && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs(DFL.ButtonItem, { layout: "below", disabled: busy || gameUp, onClick: () => up?.needs_detach ? confirmInstall(`Update to ${up.available}`, () => updateInPlace(up.available), () => updateDetached(up.available)) : run(() => updateInPlace(up.available)), children: ["Update to ", up.available] }) }), up?.state && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", color: up.state.includes("failed") ? "#ff6b6b" : undefined, opacity: up.state.includes("failed") ? 1 : 0.8 }, children: up.state }) }), su?.busy && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(Progress, { pct: su.progress, title: (su.step.startsWith("update") || up?.state.startsWith("installing")) ? "Updating" : "Installing", step: su.step, started: su.started, expect: su.expect }) }), su && !su.busy && su.rc === 0 && (SP_JSX.jsx(SP_JSX.Fragment, { children: su.needs_reboot ? (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.8 }, children: su.egpu_on_bus
                                            ? "Installed. One reboot activates the kernel parameters \u2014 the eGPU can stay plugged in."
                                            : "Installed. One reboot activates the kernel parameters. DO NOT CONNECT THE eGPU UNTIL AFTER THAT REBOOT \u2014 the protections that stop a cable event resetting the machine are kernel parameters, and they are not active yet." }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => run(rebootSystem), children: "Reboot the system" }) })] })) : (SP_JSX.jsx(SP_JSX.Fragment, { children: su.gm_restart ? (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.8 }, children: "Installed. A few changed files are only read when Game Mode starts: they apply at the next start, or restart it now." }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || gameUp, onClick: () => run(restartGamemode), children: "Restart Game Mode now" }) })] })) : SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.8 }, children: "Installed. Nothing else to do." }) }) })) })), su && !su.busy && su.cmdline_pending && su.rc !== 0 && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.8 }, children: "Reboot to activate the kernel parameters (eGPU unplugged)." }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || gameUp, onClick: () => run(rebootSystem), children: "Reboot the system" }) })] })), su && !su.busy && su.rc !== null && su.rc !== 0 && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", color: "#ff6b6b" }, children: su.rc === 21 ? "Nothing was changed: the eGPU driver is in use. Safe Detach, unplug the eGPU, then try again." : su.rc === 20 ? "Everything is installed except the NVIDIA driver, which could not be built. Keep the eGPU unplugged, check the internet connection and press Repair. Details: Show setup & updates." : `Install failed (rc ${su.rc}). Log: /tmp/egpu-buddy-setup.log` }) }), !!s?.resets?.count && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { fontSize: "12px", opacity: 0.8 }, children: ["This device was reset by its hardware ", s.resets.count === 1 ? "once" : `${s.resets.count} times`, " while the eGPU was connected (last: ", s.resets.last, "). Always use Safe Detach before unplugging."] }) }), s && !s.game_mode && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.8 }, children: "In Desktop mode use the EGPU Buddy desktop app." }) }), gameUp && s?.game_mode && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", color: "#f0b429" }, children: "A game is running. Exit it first to switch screens, attach or detach the eGPU: each of these restarts Game Mode." }) }), s?.attach_pending && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px" }, children: "eGPU plugged in. Close the game, then press Attach." }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || !s?.game_mode || gameUp || (s?.present && (s?.on_egpu || s?.egpu_handheld)), onClick: () => DFL.showModal(SP_JSX.jsx(DFL.ConfirmModal, { strTitle: "Attach the eGPU", strDescription: "Game Mode restarts on the eGPU display: the screen goes dark for a few seconds. When it is back, reopen this menu to see the result.", strOKButtonText: "Attach", onOK: () => run(() => attach(false)) })), children: "Attach eGPU" }) }), s?.game_mode && (s.on_egpu || s.egpu_handheld) && screenTargets(s, tvWakes).filter((t) => t.name !== s.output).map((t) => (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || gameUp, onClick: () => DFL.showModal(SP_JSX.jsx(DFL.ConfirmModal, { strTitle: `Show Game Mode on ${t.label}`, strDescription: `${t.detail}\n\nGame Mode restarts on that screen (the current one goes dark for a few seconds). Switch back the same way.`, strOKButtonText: "Switch", onOK: () => run(() => setGameScreen(t.name)) })), children: SP_JSX.jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }, children: [SP_JSX.jsx("span", { style: { flex: "0 0 auto" }, children: t.photo ? SP_JSX.jsx("img", { src: t.photo, style: { width: "96px", height: "auto", display: "block" } }) : SP_JSX.jsx("span", { dangerouslySetInnerHTML: { __html: t.icon } }) }), SP_JSX.jsxs("div", { style: { textAlign: "center" }, children: ["Show Game Mode on ", t.label, t.xr && SP_JSX.jsx("span", { style: { fontSize: "10px", background: "#1a9fff", borderRadius: "2px", padding: "0 4px", marginLeft: "6px" }, children: "XR" }), SP_JSX.jsx("div", { style: { fontSize: "11px", opacity: 0.7 }, children: t.detail })] })] }) }) }, t.name))), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || !s?.game_mode || !s?.present || gameUp, onClick: () => DFL.showModal(SP_JSX.jsx(DFL.ConfirmModal, { strTitle: "Safe Detach", strDescription: "Game Mode moves to the handheld screen and the eGPU is removed from the bus: the screen goes dark for a few seconds and the monitor loses signal. Do not unplug yet. When the handheld screen is back, reopen this menu: it says when it is safe to unplug the cable.", strOKButtonText: "Detach", bDestructiveWarning: true, onOK: () => run(safeDetach) })), children: "Safe Detach" }) }), s?.gm_status?.state && s.gm_status.state !== "ATTACHED" && s.gm_status.state !== "IDLE" && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "13px", fontWeight: 600, color: s.gm_status.state === "SAFE_COMPLETE" || s.gm_status.state === "DETACHED" ? "#4caf50" : s.gm_status.state.includes("DO_NOT") || s.gm_status.state === "FAILED" ? "#ff6b6b" : "#f0b429" }, children: s.gm_status.state === "SAFE_COMPLETE" || s.gm_status.state === "DETACHED" ? "Safe to unplug the cable." : s.gm_status.message }) }), tr?.message && (tr.running || tr.state === "reverted" || tr.state === "failed") && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { fontSize: "12px", color: tr.state === "failed" ? "#ff6b6b" : "#f0b429" }, children: ["Beta driver: ", tr.message] }) }), msg && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px" }, children: msg }) }), su?.step && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.85 }, children: su.step }) }), su?.busy === false && su?.rc === 0 && !su?.installed_version &&
                        SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", color: "#4caf50" }, children: "Uninstalled. The machine is back to how it was." }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || !!su?.busy, onClick: () => run(() => checkUpdate(false)), children: "Check for updates" }) }), su?.installed_version && (SP_JSX.jsx(SP_JSX.Fragment, { children: SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || !!su?.busy, onClick: askUninstall, children: "Uninstall" }) }) })), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { fontSize: "11px", opacity: 0.7 }, children: ["EGPU Buddy ", PLUGIN_VERSION, su && !su.installed_version ? " · not installed" : "", " \u00B7 ", up ? (up.available ? `update ${up.available} available` : up.checked ? "up to date" : "update check pending") : "…", up?.auto_update ? " · auto-update on" : " · auto-update off"] }) })] })), tab === "details" && !s && (SP_JSX.jsx(DFL.PanelSection, { title: "eGPU details", children: SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.8 }, children: "No eGPU connected. Setup, updates and uninstall are still available above." }) }) })), tab === "details" && s && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSection, { title: "eGPU details", children: !s.present ? (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { className: DFL.staticClasses.Text, children: "eGPU not connected." }) }), SP_JSX.jsx(Row, { k: "Session", v: s.game_mode ? "Game Mode on handheld" : "Desktop" })] })) : (SP_JSX.jsxs(SP_JSX.Fragment, { children: [s.dock && SP_JSX.jsx(Row, { k: "Dock", v: s.dock }), SP_JSX.jsx(Row, { k: "GPU", v: gpuName(tel["name"]) || (s.present ? s.bdf : "absent") }), SP_JSX.jsx(Row, { k: "Driver", v: s.driver_loaded ? `nvidia ${tel["driver_version"] ?? ""}` : "not loaded" }), SP_JSX.jsx(Row, { k: "PCIe", v: s.present ? `${s.link.speed} x${s.link.width}` : "" }), ad?.usb4 && usb4.total !== undefined && (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { padding: "6px 8px", borderRadius: "4px", fontSize: "12px",
                                            background: usb4.slow ? "#3a2a14" : "#1a3a57", border: `1px solid ${usb4.slow ? "#e3a33b" : "#1a9fff"}` }, children: [SP_JSX.jsxs("div", { style: { display: "flex", justifyContent: "space-between" }, children: [SP_JSX.jsx("span", { style: { fontWeight: 600 }, children: "USB4 link" }), SP_JSX.jsxs("b", { children: [usb4.total, " Gb/s \u00B7 ", usb4.lanes, " \u00D7 ", usb4.per_lane] })] }), SP_JSX.jsx("div", { style: { opacity: 0.85, marginTop: "2px" }, children: usb4.slow ? (usb4.lanes < 2 ? "1 lane: check the cable or port" : "slow link: check the cable or port") : usb4.name })] }) })), SP_JSX.jsx(Row, { k: "Session", v: s.game_mode ? (s.on_egpu ? `Game Mode on ${screenName(s)}` : s.egpu_handheld ? `${s.output.startsWith("eDP") ? "Handheld" : screenName(s)} + eGPU` : "Game Mode on panel") : "Desktop" }), (scr?.length ? scr : s.displays.map((d) => ({ connector: d.name, name: d.model, state: d.enabled ? "" : "off" }))).map((x) => (SP_JSX.jsx(Row, { k: x.name || x.connector, v: [screenState[x.state], x.connector.startsWith("HDMI") ? "HDMI" : x.connector.startsWith("DP") ? "DisplayPort" : x.connector].filter(Boolean).join(" · ") }, x.connector))), scr?.some((x) => x.ddc) && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy, onClick: () => run(async () => { const r = await wakeScreens(); getScreens().then(setScr).catch(() => { }); return r; }), children: "Wake screens" }) }), SP_JSX.jsx(Row, { k: "Audio", v: audioName(s.audio_sink, s.bdf) }), SP_JSX.jsx(Row, { k: "Temp", v: tel["temperature.gpu"] ? `${tel["temperature.gpu"]} °C` : "" }), SP_JSX.jsx(Row, { k: "Power", v: tel["power.draw"] ? (Number.isFinite(Number(tel["power.limit"])) ? `${Math.round(Number(tel["power.draw"]))} / ${Math.round(Number(tel["power.limit"]))} W` : xgLive.target ? `${Math.round(Number(tel["power.draw"]))} / ${xgLive.target} W target` : xgCap !== null ? `${Math.round(Number(tel["power.draw"]))} / ${xgCap} W cap` : `${Math.round(Number(tel["power.draw"]))} W`) : "" }), SP_JSX.jsx(Row, { k: "Core / mem", v: tel["clocks.gr"] ? `${tel["clocks.gr"]} / ${tel["clocks.mem"]} MHz` : "" }), SP_JSX.jsx(Row, { k: "VRAM", v: tel["memory.used"] ? `${tel["memory.used"]} / ${tel["memory.total"]} MiB` : "" }), SP_JSX.jsx(Row, { k: "Load", v: tel["utilization.gpu"] ? `${tel["utilization.gpu"]} %` : "" }), SP_JSX.jsx(Row, { k: "Fan", v: tel["fan.speed"] && Number.isFinite(Number(tel["fan.speed"])) ? `${tel["fan.speed"]} %` : (tel["name"] && s.dock ? (xg ? `${s.xgm?.fan ?? "auto"} mode (set in the XG Mobile; its speed is not readable)` : "run by the dock (not readable on Linux)") : "") })] })) }), (SP_JSX.jsxs(DFL.PanelSection, { title: "Support report", children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy, onClick: async () => { setReport(null); try {
                                        setReport(await makeReport());
                                    }
                                    catch {
                                        setMsg("Could not make the report.");
                                    } }, children: "Save support report to Desktop" }) }), report && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { fontSize: "12px" }, children: ["Scan with your phone to open a new GitHub issue with the report summary filled in. The full report is saved as ", SP_JSX.jsx("b", { children: report.file }), ": attach it to the issue."] }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { width: "240px", margin: "0 auto", background: "#fff", borderRadius: "4px" }, dangerouslySetInnerHTML: { __html: qrSvg(report.url) } }) }), SP_JSX.jsx(Row, { k: "Code", v: report.code })] })), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "11px", opacity: 0.75 }, children: "One file with everything EGPU Buddy logs (versions, GPU and link, screens, Game Mode, attach, Safe Detach, driver trial and the system log), saved in the Desktop folder. Also in Desktop Mode: the \"Save EGPU Buddy report\" icon. No serial numbers, Wi-Fi names, IP addresses or user names." }) })] })), s.present && xg && s.driver_loaded && (SP_JSX.jsxs(DFL.PanelSection, { title: "XG Mobile", children: [intro && (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("img", { src: intro.src, onClick: endIntro, style: { width: "100%", display: "block", borderRadius: "4px", transition: "opacity 0.6s", opacity: intro.fading ? 0 : 1 } }) })), !plOk && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { fontSize: "12px", opacity: 0.8 }, children: ["NVIDIA does not let the driver set this GPU's power limit (its cap is ", xgTop, " W). A power target below it makes EGPU Buddy hold the GPU there by limiting its clock", xgLive.target && xgLive.cap ? ` (now ${xgLive.cap} MHz)` : "", "."] }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.SliderField, { label: ptNow >= xgTop ? "Power target: none" : "Power target (W)", value: ptNow, min: 40, max: xgTop, step: 5, showValue: true, onChange: setPt }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || pt === null, onClick: () => { const w = ptNow >= xgTop ? 0 : ptNow; setPt(null); run(() => xgmPower(w)); }, children: "Apply power target" }) })] })), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.DropdownItem, { label: "Fan mode", selectedOption: s.xgm?.fan ?? "auto", disabled: busy, rgOptions: [["auto", "Auto (the XG Mobile's own)"], ["quiet", "Quiet"], ["balanced", "Balanced"], ["performance", "Performance"], ["max", "Max"],
                                        ...(s.xgm?.curve ? [["custom", "Custom (made in the desktop app)"]] : [])].map(([data, label]) => ({ data, label })), onChange: (o) => run(() => xgmFan(String(o.data))) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ToggleField, { label: "Lights", checked: lightOn, disabled: busy, onChange: (v) => run(() => xgmLight(v)) }) }), lightOn && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.DropdownItem, { label: "Light effect", selectedOption: s.xgm?.effect ?? "static", disabled: busy, rgOptions: [["static", "Static"], ["breathe", "Breathe"], ["cycle", "Color cycle"], ["rainbow", "Rainbow"], ["strobe", "Strobe"]].map(([data, label]) => ({ data, label })), onChange: (o) => lightFx(String(o.data)) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.DropdownItem, { label: "Light color", selectedOption: s.xgm?.color ?? "ff0000", disabled: busy, rgOptions: XGM_COLORS.map(([data, label]) => ({ data, label })), onChange: (o) => lightFx("", String(o.data)) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.DropdownItem, { label: "Light speed", selectedOption: s.xgm?.speed ?? "normal", disabled: busy, rgOptions: [["slow", "Slow"], ["normal", "Normal"], ["fast", "Fast"]].map(([data, label]) => ({ data, label })), onChange: (o) => lightFx("", "", String(o.data)) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.SliderField, { label: "Light brightness", value: s.xgm?.brightness ?? 3, min: 0, max: 3, step: 1, notchCount: 4, notchTicksVisible: true, showValue: true, disabled: busy, onChange: (v) => run(() => xgmSet("brightness", String(v))) }) })] })), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.SliderField, { label: "Core clock offset (MHz)", value: xoffNow[0], min: -300, max: 300, step: 15, showValue: true, onChange: (v) => setXoff([v, xoffNow[1]]) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.SliderField, { label: "Memory clock offset (MHz)", value: xoffNow[1], min: -1e3, max: 1500, step: 50, showValue: true, onChange: (v) => setXoff([xoffNow[0], v]) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || xoff === null, onClick: () => { const [c, m] = xoffNow; setXoff(null); run(() => xgmSet("offset", `${c}:${m}`)); }, children: "Apply clock offsets" }) }), !controlsOk && msg && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px" }, children: msg }) })] })), !s.present ? null : controlsOk ? (SP_JSX.jsxs(DFL.PanelSection, { title: "Power controls", children: [plOk ? (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.SliderField, { label: "Power limit (W)", value: plNow, min: plMin, max: plMax, step: 5, showValue: true, onChange: setPl }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || pl === null, onClick: () => run(() => setPowerLimit(plNow)), children: "Apply power limit" }) })] })) : (SP_JSX.jsxs(SP_JSX.Fragment, { children: [!xg && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { fontSize: "12px", opacity: 0.8 }, children: ["This GPU does not take a power limit from the driver (a laptop-class GPU, as in an ASUS XG Mobile): the dock sets its power", xgCap !== null ? ` (cap now ${xgCap} W${Number.isFinite(plMax) ? `, at most ${Math.round(plMax)} W` : ""})` : "", ". Limit its clock instead to lower power and heat."] }) }), !xg && clkMax > 0 && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.SliderField, { label: "Max GPU clock (MHz)", value: clkNow, min: clkMin, max: clkMax, step: 15, showValue: true, onChange: setClk }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || clk === null, onClick: () => run(() => setClockLimit(clkNow)), children: "Apply clock limit" }) })] }))] })), !xg && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.SliderField, { label: "Core clock offset (MHz)", value: off, min: -300, max: 300, step: 15, showValue: true, onChange: setOff }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy, onClick: () => run(() => setCoreOffset(off)), children: "Apply offset" }) })] })), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy, onClick: () => { setOff(0); setPl(null); setClk(null); setPt(null); setXoff(null); run(resetClocks); }, children: "Reset clocks" }) }), msg && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px" }, children: msg }) })] })) : (SP_JSX.jsx(DFL.PanelSection, { title: "Power controls", children: SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.8 }, children: "Available when Game Mode runs on the eGPU. On the handheld GPU, Game Mode's own performance menu applies." }) }) }))] })), tab === "setup" && (SP_JSX.jsxs(DFL.PanelSection, { title: "System integration", children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px" }, children: su ? (su.installed_version ? (behind ? "Installed — press Install to finish updating" : "Installed") : "Not installed") : "…" }) }), su?.untested && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { fontSize: "12px", opacity: 0.8 }, children: ["Hardware: ", su.untested.split("\n").join("; "), ". ", su.accepted_untested ? "Risk notice accepted." : "Risk notice not accepted yet."] }) }), su?.cmdline_missing && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { fontSize: "12px", opacity: 0.8 }, children: ["Kernel parameters not active: ", su.cmdline_missing] }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.8 }, children: "Reinstalls everything the first run installs. Safe to run again." }) }), su?.busy && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(Progress, { pct: su.progress, title: "Installing", step: su.step, started: su.started, expect: su.expect }) }), su && !su.busy && su.rc !== null && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", color: su.rc === 0 ? "#4caf50" : "#ff6b6b" }, children: su.rc === 0 ? "Finished." : `Failed (rc ${su.rc}).` }) }), !su?.installed_version && (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { fontSize: "12px", opacity: 0.9 }, children: [SP_JSX.jsx("b", { children: "Which eGPU will you connect?" }), " Pick one now - it only decides whether the NVIDIA driver is built. The eGPU does not need to be plugged in, and you can run the other install later if you change cards."] }) })), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || !!su?.busy, onClick: () => { if (confirmSetup === "install") {
                                setConfirmSetup("");
                                run(() => installSystem(false));
                            }
                            else
                                setConfirmSetup("install"); }, children: confirmSetup === "install"
                                ? "Press again to confirm"
                                : (su?.installed_version ? "Reinstall / update system integration" : "NVIDIA eGPU - install (builds the driver)") }) }), !su?.installed_version && (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "11px", opacity: 0.7 }, children: "Builds the patched NVIDIA driver and the gamescope scan-out fix. Takes several minutes." }) })), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || !!su?.busy, onClick: () => { if (confirmSetup === "amd") {
                                setConfirmSetup("");
                                run(() => installSystem(false, "amd"));
                            }
                            else
                                setConfirmSetup("amd"); }, children: confirmSetup === "amd"
                                ? "Press again to confirm"
                                : (su?.installed_version ? "Switch to the AMD / Intel install (no NVIDIA driver)" : "AMD / Intel eGPU - install (no driver build)") }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "11px", opacity: 0.7 }, children: "Skips the NVIDIA driver build and the NVIDIA-only gamescope fix. Keeps hot-plug, safe detach, cable-pull recovery, audio follow and the flood protections. Beta: not yet tested on real AMD or Intel hardware." }) }), su?.installed_version && su.installed_vendor === "amd" && su.egpu_on_bus === "nvidia" && (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", color: "#ffb300" }, children: "An NVIDIA eGPU is connected, but this machine was set up with the AMD install, which skips the NVIDIA driver. Run the NVIDIA install above to add it." }) })), su?.installed_version && su.installed_vendor !== "amd" && (su.egpu_on_bus === "amd" || su.egpu_on_bus === "intel") && (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", color: "#ffb300" }, children: "A non-NVIDIA eGPU is connected. The NVIDIA driver this install built is not used by it - the AMD / Intel install above suits this machine better." }) })), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || !!su?.busy || !su?.installed_version, onClick: askUninstall, children: "Uninstall system integration" }) }), su?.log && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => setLogOpen(logOpen === "setup" ? "" : "setup"), children: logOpen === "setup" ? "Hide install log" : "Show install log" }) }), su?.log && logOpen === "setup" && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "10px", whiteSpace: "pre-wrap", opacity: 0.8 }, children: su.log }) })] })), tab === "setup" && tr?.available && (SP_JSX.jsxs(DFL.PanelSection, { title: "Beta driver (advanced)", children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs("div", { style: { fontSize: "12px", opacity: 0.85 }, children: ["Tested driver: ", tr.tested, ". Beta: ", tr.beta, ", with the same eGPU patches ported to it. Running now: ", tr.installed || "not installed", "."] }) }), tr.message && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", color: tr.state === "failed" ? "#ff6b6b" : tr.state === "kept" ? "#4caf50" : "#f0b429" }, children: tr.message }) }), tr.state !== "kept" && (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs(DFL.ButtonItem, { layout: "below", disabled: busy || tr.running || !!su?.busy || gameUp || !s?.game_mode, onClick: () => DFL.showModal(SP_JSX.jsx(DFL.ConfirmModal, { strTitle: `Try beta driver ${tr.beta}`, strDescription: `For testers. The eGPU is safely detached, the beta NVIDIA driver ${tr.beta} is downloaded from NVIDIA (about 530 MB) and built on this device (10-20 minutes, about 6 GB free space needed while building), then the eGPU is attached with it and checked. If it does not come up, the tested driver ${tr.tested} is put back and attached again by itself. If the machine resets or hangs during the test, the tested driver is put back at the next boot, before the eGPU is used. Keep the charger and the eGPU connected. Everything is logged to /var/log/egpu-driver-trial.log.`, strOKButtonText: "Try the beta driver", bDestructiveWarning: true, onOK: () => run(startTrial) })), children: ["Try beta driver ", tr.beta] }) })), (tr.state === "kept" || (tr.installed && tr.installed !== tr.tested)) && (SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsxs(DFL.ButtonItem, { layout: "below", disabled: busy || tr.running || gameUp || !s?.game_mode, onClick: () => DFL.showModal(SP_JSX.jsx(DFL.ConfirmModal, { strTitle: `Return to ${tr.tested}`, strDescription: `The eGPU is safely detached, the tested driver ${tr.tested} is put back (offline, a few minutes) and the eGPU is attached again.`, strOKButtonText: "Return", onOK: () => run(revertTrial) })), children: ["Return to the tested driver ", tr.tested] }) })), tr.log && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", onClick: () => setLogOpen(logOpen === "trial" ? "" : "trial"), children: logOpen === "trial" ? "Hide driver log" : "Show driver log" }) }), tr.log && logOpen === "trial" && SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "10px", whiteSpace: "pre-wrap", opacity: 0.8 }, children: tr.log }) })] })), tab === "setup" && s?.present && s.game_mode && (SP_JSX.jsxs(DFL.PanelSection, { title: "Game screen", children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.DropdownItem, { label: "Play games on", disabled: busy || gameUp, selectedOption: s.output && s.output !== "*" ? s.output : "eDP-1", rgOptions: screenTargets(s, tvWakes).map((t) => ({ data: t.name, label: t.name === "eDP-1" ? "Handheld screen (games on the eGPU)" : t.label })), onChange: (o) => { if (o.data !== s.output)
                                run(() => setGameScreen(o.data)); } }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.8 }, children: gameUp ? "Exit the game first: switching screens restarts Game Mode." : "Switching restarts Game Mode on the chosen screen (dark for a few seconds)." }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.8 }, children: "XR glasses passthrough: glasses plugged into the handheld's USB-C show your eGPU games, with no HDMI-to-USB-C adapter on the eGPU needed." }) })] })), tab === "setup" && gr && (SP_JSX.jsx(DFL.PanelSection, { title: "Games", children: SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ToggleField, { label: "Best resolution and refresh rate on every screen", description: "On by default. Steam runs big external screens (XR glasses in ultrawide, 1440p, 4K) at 1920x1080 and starts games there with black bars. With this on, Game Mode uses each screen's highest resolution and refresh rate, follows the glasses into and out of ultrawide, and games start at the screen's size. Games you set yourself are left alone; switching this off leaves Steam's settings as they are.", checked: gr.enabled, onChange: (v) => run(async () => { const r = await setGameRes(v); setGr(await getGameRes()); return r; }) }) }) })), tab === "setup" && (SP_JSX.jsxs(DFL.PanelSection, { title: "Updates", children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ToggleField, { label: "Automatic updates", description: "Off (default): a new release is only announced here and you decide when to install it. On: it installs by itself when no game is running.", checked: !!up?.auto_update, onChange: (v) => run(() => setAutoUpdate(v)) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy || !!su?.busy, onClick: () => run(() => checkUpdate(false)), children: "Check for updates now" }) }), SP_JSX.jsx(ReleaseNotes, { label: up?.available ? `What's new in ${up.available}` : "Release notes" }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.8 }, children: up ? (up.available ? `Available: ${up.available}` : (up.checked ? "Up to date." : "Not checked yet.")) + (up.last_error ? ` ${up.last_error}` : "") : "…" }) })] })), tab === "setup" && (SP_JSX.jsxs(DFL.PanelSection, { title: "Extras (testing)", children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.8 }, children: "All off by default." }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ToggleField, { label: "USB4 link speed", description: "Adds a USB4 row to the Details tab and warns about a slow cable or port.", checked: !!ad?.usb4, onChange: (v) => run(async () => { const r = await setAddon("usb4", v); await refresh(); return r; }) }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ToggleField, { label: "TV control tricks", description: "Off by default. Choosing the TV for Game Mode turns it on and switches it to the eGPU's HDMI input; while it shows live TV or another input, the desktop leaves it out. LG webOS TVs over the network for now.", checked: !!tv?.enabled, onChange: (v) => run(() => setTvControl(v)) }) }), tv?.enabled && (SP_JSX.jsxs(SP_JSX.Fragment, { children: [SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx("div", { style: { fontSize: "12px", opacity: 0.8 }, children: tv.paired.length ? `Paired: ${tv.paired.join(", ")}` : "No TV paired yet." }) }), SP_JSX.jsx(DFL.PanelSectionRow, { children: SP_JSX.jsx(DFL.ButtonItem, { layout: "below", disabled: busy, onClick: () => { setMsg("Choose Allow on the TV's prompt…"); run(pairTv); }, children: tv.paired.length ? "Pair again" : "Find and pair TV" }) })] }))] }))] }));
}
var index = definePlugin(() => {
    // the finish line must reach the user even when the menu was closed or Decky restarted (plugin update) meanwhile
    const notices = setInterval(async () => {
        try {
            const t = await popNotice();
            if (t)
                toaster.toast({ title: "EGPU Buddy", body: t, duration: 15000 });
        }
        catch { /* backend not up yet */ }
        try {
            await maybeShowTrial();
        }
        catch { /* backend not up yet */ }
        try {
            await maybeOfferScreen();
        }
        catch { /* backend not up yet */ }
        try {
            const ch = await gameResSync();
            for (const [id, res] of Object.entries(ch))
                window.SteamClient?.Apps?.SetAppResolutionOverride(Number(id), res);
        }
        catch { /* backend not up yet */ }
    }, 5000);
    // a game starting: match its Steam game resolution to the screen Game Mode is on (Setup option, on by default)
    const sc = window.SteamClient, details = () => window.appDetailsStore;
    // a screen or mode change (another screen, XR glasses switched to ultrawide): its best mode, after Steam settles
    let modeTimer = null;
    const modes = sc?.System?.DisplayManager?.RegisterForStateChanges?.(() => { clearTimeout(modeTimer); modeTimer = setTimeout(() => applyBestScreenModes().catch(() => { }), 2000); });
    setTimeout(() => applyBestScreenModes().catch(() => { }), 3000);
    const launches = sc?.Apps?.RegisterForGameActionStart?.(async (_id, appid, action) => {
        if (!/launch/i.test(String(action)))
            return;
        try {
            const id = Number(appid), r = await gameResFor(id, details()?.GetAppDetails(id)?.strResolutionOverride ?? "");
            if (r.set)
                sc.Apps.SetAppResolutionOverride(id, r.set);
        }
        catch { /* backend not up yet */ }
    });
    return {
        name: "EGPU Buddy",
        title: SP_JSX.jsx("div", { className: DFL.staticClasses.Title, children: "EGPU Buddy" }),
        content: SP_JSX.jsx(Content, {}),
        icon: SP_JSX.jsx(FaPlug, {}),
        onDismount() { clearInterval(notices); launches?.unregister?.(); modes?.unregister?.(); clearTimeout(modeTimer); },
    };
});

export { index as default };
//# sourceMappingURL=index.js.map
