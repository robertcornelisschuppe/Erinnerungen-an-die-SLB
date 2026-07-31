// christopher pietsch
// cpietsch@gmail.com
// 2015-2018

function Canvas() {
  var margin = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };

  var hashDelay = 800;

  var minHeight = 400;
  var width = window.innerWidth - margin.left - margin.right;
  var widthOuter = window.innerWidth;
  var height = window.innerHeight;

  var scale;
  var scale1 = 1;
  var scale2 = 1;
  var scale3 = 1;
  var allData = [];

  var translate = [0, 0];
  var scale = 1;
  var timeDomain = [];
  var canvasDomain = [];
  var loadImagesCue = [];

  var resolution = window.devicePixelRatio || 1;

  var x = d3.scale
    .ordinal()
    .rangeBands([margin.left, width + margin.left], 0.2);

  var yscale = d3.scale.linear();

  var Quadtree = d3.geom
    .quadtree()
    .x(function (d) {
      return d.x;
    })
    .y(function (d) {
      return d.y;
    });

  var quadtree;

  var maxZoomLevel = utils.isMobile() ? 5000 : 2500;

  var zoom = d3.behavior
    .zoom()
    .scaleExtent([1, maxZoomLevel])
    .size([width, height])
    .on("zoom", zoomed)
    .on("zoomend", zoomend)
    .on("zoomstart", zoomstart);

  var canvas;
  var config;
  var container;
  var entries;
  var years;
  var data;
  var rangeBand = 0;
  var rangeBandImage = 0;
  var imageSize = 256;
  var imageSize2 = 1024;
  var imageSize3 = 4000;
  var columns = 4;
  var renderer, stage;

  var svgscale, voronoi;

  var selectedImageDistance = 0;
  var selectedImage = null;

  var drag = false;
  var sleep = false;

  var stagePadding = 40;
  var imgPadding;

  var bottomPadding = 40;
  var extent = [0, 0];
  var bottomZooming = false;

  var touchstart = 0;
  var vizContainer;
  var spriteClick = false;

  var state = {
    lastZoomed: 0,
    zoomingToImage: false,
    init: false,
    mode: "time",
  };

  var zoomedToImage = false;
  var zoomedToImageScale = 117;
  var zoomBarrier = 2;

  var startTranslate = [0, 0];
  var startScale = 0;
  var cursorCutoff = 1;
  var zooming = false;
  var detailContainer = d3.select(".detail");
  var timelineData;
  var stage, stage1, stage2, stage3, stage4, stage5;
  var timelineHover = false;
  var tsneIndex = {};
  var tsneScale = {};
  var mediaPlayerContainer;
  var currentMediaLink = null; // Verhindert Video-Flackern

  function canvas() { }

  canvas.margin = margin;

  var annotationVectors = "";
  var annotationVectorGraphics = undefined;

  canvas.abs2relCoordinate = function (p) {
    return [
      (p[0] / widthOuter) * 100,
      ((-1 * p[1]) / widthOuter) * 100,
    ].map(function (d) {
      return Math.round(d * 100) / 100;
    });
  };

  canvas.rel2absCoordinate = function (p) {
    return [
      (p[0] / 100) * widthOuter,
      (-1 * p[1] / 100) * widthOuter,
    ];
  };

  canvas.addVector = function (startNew) {
    if (startNew === void 0) { startNew = false; }
    var mouse = d3.mouse(vizContainer.node());
    var p = toScreenPoint(mouse);
    var relative = canvas.abs2relCoordinate(p);

    if (startNew || annotationVectors.length == 0) {
      annotationVectors += (annotationVectors.length ? "," : "") + "w1";
    }

    annotationVectors += "," + relative[0] + "-" + relative[1];
    utils.updateHash("vector", annotationVectors);
    canvas.drawVectors();
  };

  canvas.parseVectors = function (v) {
    if (v == undefined || v == "") return;

    var parts = v.split(",");
    var vectors = [];
    var currentVector = [];
    var currentWeight = 1;
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (part.startsWith("w")) {
        if (currentVector.length > 0) {
          vectors.push({
            vector: currentVector,
            weight: currentWeight,
          });
        }
        currentWeight = parseFloat(part.replaceAll("w", ""));
        currentVector = [];
      } else {
        var coords = part.split("-").map(function (d) {
          return parseFloat(d);
        });
        if (coords.length == 2) {
          var decodeAnnotationCoordinates = canvas.rel2absCoordinate(coords);
          currentVector.push(decodeAnnotationCoordinates);
        }
      }
    }
    if (currentVector.length > 0) {
      vectors.push({
        vector: currentVector,
        weight: currentWeight,
      });
    }
    return vectors;
  };

  canvas.drawVectors = function () {
    if (annotationVectorGraphics) {
      stage3.removeChild(annotationVectorGraphics);
      annotationVectorGraphics.destroy(true);
      annotationVectorGraphics = undefined;
    }

    if (annotationVectors.length == 0) return;

    var parsedVectors = canvas.parseVectors(annotationVectors);
    annotationVectorGraphics = new PIXI.Graphics();

    for (var i = 0; i < parsedVectors.length; i++) {
      var vector = parsedVectors[i].vector;
      var weight = parsedVectors[i].weight;
      
      var lineColorHash = (config.style && config.style.annotationLineColor) || "#00ff00";
      var color = parseInt(lineColorHash.substring(1), 16);
      annotationVectorGraphics.lineStyle(weight, color, 1);
      
      for (var j = 0; j < vector.length - 1; j++) {
        var start = vector[j];
        var end = vector[j + 1];
        annotationVectorGraphics.moveTo(start[0], start[1]);
        annotationVectorGraphics.lineTo(end[0], end[1]);
      }
      annotationVectorGraphics.endFill();
      annotationVectorGraphics.position.x = 0;
      annotationVectorGraphics.position.y = 0;
      annotationVectorGraphics.scale.x = scale1;
      annotationVectorGraphics.scale.y = scale1;
      annotationVectorGraphics.interactive = false;
      annotationVectorGraphics.buttonMode = false;
      annotationVectorGraphics.visible = true;
      annotationVectorGraphics.zIndex = 1000;
    }

    stage3.addChild(annotationVectorGraphics);
    sleep = false;
    animate();
  };

  canvas.removeAllVectors = function () {
    if (annotationVectorGraphics) {
      stage3.removeChild(annotationVectorGraphics);
      annotationVectorGraphics.destroy(true);
      annotationVectorGraphics = undefined;
    }
    annotationVectors = "";
    sleep = false;
  };

  canvas.removeAllCustomGraphics = function () {
    canvas.removeAllVectors();
    canvas.removeAllBorders();
  };

  canvas.clearMedia = function () {
    if (mediaPlayerContainer) {
      mediaPlayerContainer.html("");
      mediaPlayerContainer.style("display", "none");
    }
    currentMediaLink = null;
  };

  canvas.loadMedia = function (d) {
    var link = d ? d.media_link : null;
    if (!link) {
      canvas.clearMedia();
      return;
    }

    // FIX: Kein Flackern mehr, falls das Video desselben Eintrags bereits geladen ist
    if (currentMediaLink === link && mediaPlayerContainer && mediaPlayerContainer.html() !== "") {
      return;
    }
    currentMediaLink = link;

    var iframeHtml = "";

    if (link.includes("youtube.com") || link.includes("youtu.be")) {
      var videoId = "";
      if (link.includes("youtu.be/")) {
        videoId = link.split("youtu.be/")[1].split(/[?&]/)[0];
      } else if (link.includes("v=")) {
        videoId = link.split("v=")[1].split(/[?&]/)[0];
      }
      if (videoId) {
        iframeHtml = '<iframe class="media-iframe" src="https://www.youtube.com/embed/' + videoId + '?autoplay=1&rel=0&showinfo=0&controls=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
      }
    } else if (link.includes("soundcloud.com/player/")) {
      iframeHtml = '<iframe class="media-iframe" scrolling="no" frameborder="no" allow="autoplay" src="' + link + '&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=true"></iframe>';
    } else if (link.match(/\.(mp4|ogg|webm)$/i)) {
      iframeHtml = '<video class="media-iframe" controls autoplay><source src="' + link + '" type="video/mp4">Your browser does not support the video tag.</video>';
    } else if (link.match(/\.(mp3|wav|ogg)$/i)) {
      iframeHtml = '<audio id="vikus-audio-player" controls autoplay style="width:100%;"><source src="' + link + '" type="audio/mpeg"><source src="' + link + '">Your browser does not support the audio element.</audio>';
    }

    if (iframeHtml) {
      mediaPlayerContainer.html(iframeHtml);
      mediaPlayerContainer.style("display", "block");

      var ratio = d.aspect_ratio || "16:9"; 
      var padding = "56.25%"; 

      if (ratio === "4:3") {
        padding = "75%"; 
      } else if (ratio === "1:1") {
        padding = "100%"; 
      }

      mediaPlayerContainer.style("padding-bottom", padding);

      var player = document.getElementById('vikus-audio-player');
      if (player) {
        setTimeout(function() {
          player.play().catch(function(error) {
            console.log("Audio autoplay blocked", error);
          });
        }, 100); 
      }
    } else {
      canvas.clearMedia();
    }
  };

  canvas.getView = function () {
    var visibleItems = [];
    var invScale = 1 / scale;
    var viewLeft = (-translate[0] * invScale);
    var viewTop = (-translate[1] * invScale) - height;
    var viewRight = viewLeft + widthOuter * invScale;
    var viewBottom = viewTop + height * invScale;

    data.forEach(function (d) {
      var px = d.x1 / scale1;
      var py = d.y1 / scale1;
      var halfH = 0;
      var halfW = 0;

      var left = px - halfW;
      var right = px + halfW;
      var top = py - halfH;
      var bottom = py + halfH;

      if (
        left >= viewLeft &&
        right <= viewRight &&
        top >= viewTop &&
        bottom <= viewBottom
      ) {
        visibleItems.push(d);
      }
    });

    if (visibleItems.length === 0 || visibleItems.length == data.length) {
      return [];
    }

    var mostLeft = null;
    var mostRight = null;
    var mostTop = null;
    var mostBottom = null;

    visibleItems.forEach(function (d) {
      if (!mostLeft || d.x < mostLeft.x) mostLeft = d;
      if (!mostRight || d.x > mostRight.x) mostRight = d;
      if (!mostTop || d.y < mostTop.y) mostTop = d;
      if (!mostBottom || d.y > mostBottom.y) mostBottom = d;
    });

    var unique = new Set([
      mostLeft && mostLeft.id,
      mostRight && mostRight.id,
      mostTop && mostTop.id,
      mostBottom && mostBottom.id,
    ]);

    return Array.from(unique).filter(function (id) { return id !== undefined && id !== null; });
  };

  canvas.setView = function (ids, duration) {
    if (duration === void 0) { duration = 1000; }
    var items = data.filter(function (d) { return ids.includes(d.id); });
    if (!items.length) return;

    if (items.length == 1) {
      var d = items[0];
      selectedImage = d;
      
      if (typeof zoomToImage === "function") {
        showDetail(d);
        loadBigImage(d, "click");
        hideTheRest(d);
        zoomToImage(d, duration);
        return;
      }
    }

    vizContainer.style("pointer-events", "none");
    zoom.center(null);
    state.zoomingToImage = true;

    var xs = items.map(function (d) { return d.x; });
    var ys = items.map(function (d) { return d.y; });

    var minX = d3.min(xs);
    var maxX = d3.max(xs);
    var minY = d3.min(ys);
    var maxY = d3.max(ys);

    var widthVal = canvas.width();
    var heightVal = canvas.height();

    var padding = rangeBandImage / 2;
    var boxWidth = maxX - minX + padding * 2;
    var boxHeight = maxY - minY + padding * 2;

    var centerX = (minX + maxX) / 2;
    var centerY = (minY + maxY) / 2;

    var targetScale = 0.9 / Math.max(boxWidth / widthVal, boxHeight / heightVal);

    var currentSidebarWidth = Math.min(700, widthOuter * 0.4);
    var translateTarget = [
      (widthVal - currentSidebarWidth) / 2 - targetScale * centerX,
      heightVal / 2 - targetScale * centerY
    ];

    var startS = scale;
    var startT = [translate[0], translate[1]];
    var iScale = d3.interpolateNumber(startS, targetScale);
    var iTranslate = d3.interpolateArray(startT, translateTarget);

    vizContainer
      .interrupt()
      .transition()
      .duration(duration)
      .tween("zoom", function () {
        return function (t) {
          var s = iScale(t);
          var tr = iTranslate(t);

          scale = s;
          translate = tr;
          zoom.scale(s).translate(tr);

          stage2.scale.x = s;
          stage2.scale.y = s;
          stage2.x = tr[0];
          stage2.y = tr[1];

          sleep = false;
        };
      })
      .each("end", function () {
        state.zoomingToImage = false;
        vizContainer.style("pointer-events", "auto");
        
        var settledFrames = 5;
        function settleLayout() {
          sleep = false;
          if (typeof animate === "function") animate();
          if (settledFrames-- > 0) {
            requestAnimationFrame(settleLayout);
          }
        }
        settleLayout();
      });
  };

  canvas.rangeBand = function () { return rangeBand; };
  canvas.width = function () { return width; };
  canvas.height = function () { return height; };
  canvas.rangeBandImage = function () { return rangeBandImage; };
  canvas.zoom = zoom;
  canvas.selectedImage = function () { return selectedImage; };
  canvas.x = x;
  canvas.y = yscale;

  canvas.makeScales = function () {
    x.rangeBands([margin.left, width + margin.left], 0.2);

    rangeBand = x.rangeBand();
    rangeBandImage = rangeBand / columns;
    imgPadding = rangeBand / columns / 2;

    scale1 = imageSize / rangeBandImage;
    scale2 = imageSize2 / rangeBandImage;
    scale3 = imageSize3 / rangeBandImage;

    stage3.scale.x = 1 / scale1;
    stage3.scale.y = 1 / scale1;
    stage3.y = height;

    stage4.scale.x = 1 / scale2;
    stage4.scale.y = 1 / scale2;
    stage4.y = height;

    stage5.scale.x = 1 / scale3;
    stage5.scale.y = 1 / scale3;
    stage5.y = height;

    timeline.rescale(scale1);

    cursorCutoff = (1 / scale1) * imageSize * 0.48;
    zoomedToImageScale =
      (0.8 / (rangeBand / columns / width)) *
      (state.mode.type === "group" ? 1 : 0.5);
  };

  canvas.initGroupLayout = function () {
    var groupKey = state.mode.groupKey;
    canvasDomain = d3
      .nest()
      .key(function (d) { return d[groupKey]; })
      .entries(data.concat(timelineData))
      .sort(function (a, b) { return a.key - b.key; })
      .map(function (d) { return d.key; });

    timeDomain = canvasDomain.map(function (d) {
      return {
        key: d,
        values: timelineData
          .filter(function (e) { return d == e[groupKey]; })
          .map(function (e) {
            e.type = "timeline";
            return e;
          })
      };
    });

    timeline.init(timeDomain);
    x.domain(canvasDomain);
  };

  canvas.init = function (_data, _timeline, _config) {
    data = _data;
    config = _config;
    timelineData = _timeline;

    container = d3.select(".page").append("div").classed("viz", true);
    detailVue._data.structure = config.detail.structure;

    var detailInner = d3.select(".detail .inner");
    mediaPlayerContainer = detailInner.append("div")
      .classed("media-player-container", true);   
    
    columns = config.projection.columns;
    imageSize = config.loader.textures.medium.size;
    imageSize2 = config.loader.textures.detail.size;

    if (config.loader.textures.big) {
      imageSize3 = config.loader.textures.big.size;
    }

    canvas.resize = function () {
      if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        return;
      }

      if (!state.init) return;

      var oldWidth = width;
      var oldHeight = height;
      var oldTranslateY = translate[1];

      widthOuter = window.innerWidth;
      width = widthOuter - margin.left - margin.right;
      height = window.innerHeight;
      
      resolution = window.devicePixelRatio || 1;

      if (renderer) {
        renderer.resolution = resolution;
        renderer.resize(widthOuter, height);
        renderer.view.style.width = widthOuter + "px";
        renderer.view.style.height = height + "px";
      }
      if (zoom) zoom.size([width, height]);

      var widthRatio = oldWidth > 0 ? width / oldWidth : 1;

      canvas.makeScales();
      canvas.project();

      data.forEach(function(d) {
        if (d.sprite) {
          d.sprite.position.x = d.x1;
          d.sprite.position.y = d.y1;
        }
        if (d.sprite2) {
          d.sprite2.position.x = d.x * scale2 + imageSize2 / 2;
          d.sprite2.position.y = d.y * scale2 + imageSize2 / 2;
        }
      });
      
      if (canvas.updateBorderPositions) canvas.updateBorderPositions();

      if (zoomedToImage && selectedImage) {
        if (typeof clearBigImages === "function") clearBigImages();
        if (canvas.setView) {
          canvas.setView([selectedImage.id], 0); 
        }
      } else {
        translate[0] = translate[0] * widthRatio;
        translate[1] = (height / 2) - ((oldHeight / 2 - oldTranslateY - oldHeight * scale) * widthRatio) - (height * scale);
        
        zoom.translate(translate);
        stage2.x = translate[0];
        stage2.y = translate[1];
      }

      sleep = false;
      if (typeof animate === "function") animate();
    };
        
    window.addEventListener("resize", canvas.resize);
        
    var renderOptions = {
      resolution: resolution,
      antialiasing: true,
      transparent: true,
      width: width + margin.left + margin.right,
      height: height,
    };
    renderer = new PIXI.Renderer(renderOptions);
    window.renderer = renderer;

    var renderElem = d3.select(container.node().appendChild(renderer.view));
    renderElem.style("width", widthOuter + "px");
    renderElem.style("height", height + "px");

    stage = new PIXI.Container();
    stage2 = new PIXI.Container();
    stage3 = new PIXI.Container();
    stage4 = new PIXI.Container();
    stage5 = new PIXI.Container();

    stage.addChild(stage2);
    stage2.addChild(stage3);
    stage2.addChild(stage4);
    stage2.addChild(stage5);

    canvas.initGroupLayout();

    data.forEach(function (d) {
      var sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
      sprite.anchor.x = 0.5;
      sprite.anchor.y = 0.5;
      sprite.scale.x = d.scaleFactor;
      sprite.scale.y = d.scaleFactor;
      sprite._data = d;
      d.sprite = sprite;
      stage3.addChild(sprite);
    });

    var lastClick = 0;

    vizContainer = d3
      .select(".viz")
      .call(zoom)
      .on("mousemove", mousemove)
      .on("dblclick.zoom", null)
      .on("dblclick", null)
      .on("touchstart", function (d) {
        mousemove(d);
        touchstart = new Date() * 1;
      })
      .on("click", function () {
        if (d3.event.shiftKey) {
          canvas.addBorderToImage(selectedImage);
          return;
        }
        if (d3.event.ctrlKey || d3.event.metaKey) {
          var startNew = d3.event.altKey;
          canvas.addVector(startNew);
          return;
        }

        var clicktime = new Date() * 1 - lastClick;
        if (clicktime < 250) return;
        lastClick = new Date() * 1;

        if (spriteClick) {
          spriteClick = false;
          return;
        }

        if (selectedImage && !selectedImage.id) return;
        if (drag) return;
        if (selectedImageDistance > cursorCutoff) return;
        if (selectedImage && selectedImage.active === false) return;
        if (timelineHover) return;
        
        userInteraction = true;

        // FIX: Nur herauszoomen, wenn genau DAS BEREITS VERGRÖSSERTE BILD nochmals geklickt wird
        if (zoomedToImage && selectedImage && selectedImage.id === (selectedImageDistance < cursorCutoff ? selectedImage.id : null)) {
          canvas.resetZoom();
        } else if (selectedImage) {
          var calcDuration = Math.round(1400 / Math.sqrt(Math.sqrt(scale)));
          canvas.setView([selectedImage.id], calcDuration);
        }
      });

    vizContainer.on("contextmenu", function () {
      if (window.top == window.self) d3.event.preventDefault();
    });

    animate();
    state.init = true;

    window.addEventListener("keydown", function(event) {
      if (event.key === "Escape" || event.keyCode === 27) {
        var isSidebarOpen = window.location.hash.indexOf("ids=") !== -1;
        if (isSidebarOpen) {
          event.preventDefault();
          event.stopPropagation();
          if (typeof utils !== "undefined" && utils.updateHash) {
            utils.updateHash("ids", "");
          }
        } else {
          event.preventDefault();
          event.stopPropagation();
          canvas.resetZoom();
        }
      }
    }, true);
  };
  
  var imageBorders = {};

  canvas.updateBorderPositions = function () {
    var graphics = d3.values(imageBorders);
    if (graphics.length == 0) return;
    graphics.forEach(function (graphic) {
      var d = graphic.source;
      graphic.position.x = d.sprite.position.x - d.sprite.width / 2;
      graphic.position.y = d.sprite.position.y - d.sprite.height / 2;
    });
  };

  canvas.removeBorder = function (id) {
    if (imageBorders.hasOwnProperty(id)) {
      stage3.removeChild(imageBorders[id]);
      delete imageBorders[id];
      sleep = false;
    }
  };

  canvas.removeAllBorders = function () {
    d3.values(imageBorders).forEach(function (d) {
      stage3.removeChild(d);
    });
    imageBorders = {};
    sleep = false;
  };

  canvas.addBorder = function (d) {
    sleep = false;
    var sprite = d.sprite;
    var graphics = new PIXI.Graphics();
    var borderColorHash = (config.style && config.style.annotationBorderColor) || "#ff0000";
    var borderColor = parseInt(borderColorHash.substring(1), 16);
    graphics.lineStyle(5, borderColor, 1);
    graphics.drawRect(0, 0, sprite.width, sprite.height);
    graphics.position.x = sprite.position.x - sprite.width / 2;
    graphics.position.y = sprite.position.y - sprite.height / 2;
    graphics.source = d;
    stage3.addChild(graphics);
    imageBorders[d.id] = graphics;
  };

  canvas.addBorderToImage = function (d) {
    sleep = false;
    if (imageBorders.hasOwnProperty(d.id)) {
      stage3.removeChild(imageBorders[d.id]);
      delete imageBorders[d.id];
      updateHashBorders();
      return;
    }
    canvas.addBorder(d);
    updateHashBorders();
  };

  function updateImageBorders(borderIds) {
    var enter = borderIds.filter(function (d) { return !imageBorders.hasOwnProperty(d); });
    var exit = Object.keys(imageBorders).filter(function (d) { return !borderIds.includes(d); });

    enter.forEach(function (id) {
      var d = data.find(function (d) { return d.id == id; });
      if (d) canvas.addBorderToImage(d);
    });

    exit.forEach(function (id) {
      canvas.removeBorder(id);
    });
  }

  function updateHashBorders() {
    if (!d3.event) return;
    var borders = Object.keys(imageBorders);
    utils.updateHash("borders", borders);
  }

  canvas.addTsneData = function (name, d, scale) {
    tsneIndex[name] = {};
    tsneScale[name] = scale;
    var clean = d.map(function (d) {
      return {
        id: d.id,
        x: parseFloat(d.x),
        y: parseFloat(d.y),
      };
    });
    var xExtent = d3.extent(clean, function (d) { return d.x; });
    var yExtent = d3.extent(clean, function (d) { return d.y; });

    var x = d3.scale.linear().range([0, 1]).domain(xExtent);
    var y = d3.scale.linear().range([0, 1]).domain(yExtent);

    d.forEach(function (d) {
      tsneIndex[name][d.id] = [x(d.x), y(d.y)];
    });
  };

  function mousemove(d) {
    if (timelineHover) return;

    var mouse = d3.mouse(vizContainer.node());
    var p = toScreenPoint(mouse);
    var distance = 200;

    var best = utils.nearest(
      p[0] - imgPadding,
      p[1] - imgPadding,
      { d: distance, p: null },
      quadtree
    );

    selectedImageDistance = best && best.d || 1000;

    if (best && best.p && !zoomedToImage) {
      var d = best.p;
      var center = [
        (d.x + imgPadding) * scale + translate[0],
        (height + d.y + imgPadding) * scale + translate[1],
      ];
      zoom.center(center);
      selectedImage = d;
    }

    container.style("cursor", function () {
      return selectedImageDistance < cursorCutoff ? "pointer" : "default";
    });

    if (d3.event.shiftKey) {
      container.style("cursor", "copy");
    }
    if (d3.event.ctrlKey || d3.event.metaKey) {
      container.style("cursor", "crosshair");
      if(d3.event.altKey) {
        container.style("cursor", "cell");
      }
    }
  }
  
  function stackLayout(data, invert) {
    var groupKey = state.mode.groupKey;
    var years = d3.nest().key(function (d) { return d[groupKey]; }).entries(data);

    years.forEach(function (year) {
      var startX = x(year.key);
      var total = year.values.length;
      year.values.sort(function (a, b) {
        return b.keywords.length - a.keywords.length;
      });

      year.values.forEach(function (d, i) {
        var row = Math.floor(i / columns) + 2;
        d.ii = i;
        d.x = startX + (i % columns) * (rangeBand / columns);
        d.y = (invert ? 1 : -1) * (row * (rangeBand / columns));

        d.x1 = d.x * scale1 + imageSize / 2;
        d.y1 = d.y * scale1 + imageSize / 2;

        if (d.sprite.position.x == 0) {
          d.sprite.position.x = d.x1;
          d.sprite.position.y = d.y1;
        }

        if (d.sprite2) {
          d.sprite2.position.x = d.x * scale2 + imageSize2 / 2;
          d.sprite2.position.y = d.y * scale2 + imageSize2 / 2;
        }

        d.order = (invert ? 1 : 1) * (total - i);
      });
    });
  }

  function stackYLayout(data, invert) {
    if (data.length == 0) return;
    var groupKey = state.mode.groupKey;
    var years = d3.nest().key(function (d) { return d[groupKey]; }).entries(data);

    var yExtent = d3.extent(data, function (d) { return +d[state.mode.y]; });
    var yRange = [2 * (rangeBand / columns), height * 0.7];
    yExtent[0] = 0;

    var yscale = d3.scale.linear().domain(yExtent).range(yRange);

    years.forEach(function (year) {
      var startX = x(year.key);
      year.values.sort(function (a, b) {
        return b[state.mode.y] - a[state.mode.y];
      });

      year.values.forEach(function (d, i) {
        d.ii = i;
        d.x = startX + (i % columns) * (rangeBand / columns);
        d.y = (invert ? 1 : -1) * yscale(d[state.mode.y]);

        d.x1 = d.x * scale1 + imageSize / 2;
        d.y1 = d.y * scale1 + imageSize / 2;

        if (d.sprite.position.x == 0) {
          d.sprite.position.x = d.x1;
          d.sprite.position.y = d.y1;
        }

        if (d.sprite2) {
          d.sprite2.position.x = d.x * scale2 + imageSize2 / 2;
          d.sprite2.position.y = d.y * scale2 + imageSize2 / 2;
        }
      });
    });
  }

  function imageAnimation() {
    var sleep = true;
    var diff, d;

    for (var i = 0; i < data.length; i++) {
      d = data[i];
      diff = d.x1 - d.sprite.position.x;
      if (Math.abs(diff) > 0.1) {
        d.sprite.position.x += diff * 0.04;
        sleep = false;
      }

      diff = d.y1 - d.sprite.position.y;
      if (Math.abs(diff) > 0.1) {
        d.sprite.position.y += diff * 0.04;
        sleep = false;
      }

      diff = d.alpha - d.sprite.alpha;
      if (Math.abs(diff) > 0.01) {
        d.sprite.alpha += diff * 0.2;
        sleep = false;
      }

      d.sprite.visible = d.sprite.alpha > 0.1;

      if (d.sprite2) {
        diff = d.alpha2 - d.sprite2.alpha;
        if (Math.abs(diff) > 0.01) {
          d.sprite2.alpha += diff * 0.2;
          sleep = false;
        }

        d.sprite2.visible = d.sprite2.alpha > 0.1;
      }
    }
    canvas.updateBorderPositions();
    return sleep;
  }

  canvas.wakeup = function () {
    sleep = false;
  };

  canvas.setMode = function (layout) {
    state.mode = layout;

    if (layout.type == "group") {
      canvas.initGroupLayout();
      columns = layout.columns || config.projection.columns;
    }

    timeline.setDisabled(layout.type != "group" && !layout.timeline);
    canvas.makeScales();
    canvas.project();
    canvas.resetZoom();
  };

  canvas.getMode = function () {
    return state.mode;
  };

  function animate() {
    requestAnimationFrame(animate);
    loadImages();
    if (sleep) return;
    sleep = imageAnimation();
    renderer.render(stage);
  }

  function zoomToImage(d, duration) {
    state.zoomingToImage = true;
    vizContainer.style("pointer-events", "none");
    zoom.center(null);
    
    loadMiddleImage(d);
    loadBigImage(d, "click");
    
    d3.select(".tagcloud").classed("hide", true);

    var padding = rangeBandImage / 2;
    var max = Math.max(width, height);
    var targetScale = 1 / (rangeBandImage / (max * 0.85));
    
    var imageAspectRatio = 1;
    if (d.sprite && d.sprite.texture && d.sprite.texture.width > 0) {
      imageAspectRatio = d.sprite.texture.height / d.sprite.texture.width;
    } else if (d.sprite && d.sprite.width > 0) {
      imageAspectRatio = d.sprite.height / d.sprite.width;
    }
    var screenImageHeight = (rangeBandImage * targetScale) * imageAspectRatio;
    var maxScreenHeight = height * 0.9; 
    if (screenImageHeight > maxScreenHeight) {
      targetScale = targetScale * (maxScreenHeight / screenImageHeight);
    }
    
    var currentSidebarWidth = Math.min(700, widthOuter * 0.4);
    var visibleCenter = (width - currentSidebarWidth) / 2;

    var translateNow = [
      visibleCenter - targetScale * (d.x + padding),
      height / 2 - targetScale * (height + d.y + padding)
    ];
  
    zoomedToImageScale = targetScale;

    setTimeout(function () {
      hideTheRest(d);
    }, duration / 2);

    // FIX: Lineare Frame-für-Frame Interpolation anstelle von d3.interpolateZoom
    // Verhindert das Ausholen/Herauszoomen
    var startS = scale;
    var startT = [translate[0], translate[1]];
    var iScale = d3.interpolateNumber(startS, targetScale);
    var iTranslate = d3.interpolateArray(startT, translateNow);

    vizContainer
      .interrupt()
      .transition()
      .duration(duration)
      .tween("zoom", function () {
        return function (t) {
          var s = iScale(t);
          var tr = iTranslate(t);

          scale = s;
          translate = tr;
          zoom.scale(s).translate(tr);

          stage2.scale.x = s;
          stage2.scale.y = s;
          stage2.x = tr[0];
          stage2.y = tr[1];

          if (typeof timeline !== "undefined" && timeline.update) {
            var x1 = (-1 * tr[0]) / s;
            var x2 = x1 + widthOuter / s;
            timeline.update(x1, x2, s, tr, scale1);
          }

          sleep = false;
        };
      })
      .each("end", function () {
        zoomedToImage = true;
        selectedImage = d;
        hideTheRest(d);
        showDetail(d);
        state.zoomingToImage = false;
        vizContainer.style("pointer-events", "auto");
        utils.updateHash("ids", d.id, ["translate", "scale"]);
      });
  }
  canvas.zoomToImage = zoomToImage;

  function showDetail(d) {
    detailContainer.select(".outer").node().scrollTop = 0;
    detailContainer.classed("hide", false).classed("sneak", utils.isMobile() || isInIframe);

    var detailData = {};
    config.detail.structure.forEach(function (field) {
      var val = selectedImage[field.source];
      detailData[field.source] = (val && val !== "") ? val : "";
      if (field.fields && field.fields.length) {
        field.fields.forEach(function (subfield) {
          var subVal = selectedImage[subfield];
          detailData[subfield] = (subVal && subVal !== "") ? subVal : "";
        });
      }
    });

    detailData["_id"] = selectedImage.id;
    detailData["_keywords"] = selectedImage.keywords || "None";
    detailData["_year"] = selectedImage.year;
    detailData["_imagenum"] = selectedImage.imagenum || 1;
    detailVue.id = d.id;
    detailVue.page = d.page;
    detailVue.item = detailData;

    // FIX: Nur Medien laden, falls nicht bereits vorhanden
    if (d.media_link) {
      canvas.loadMedia(d);
    } else {
      canvas.clearMedia();
    }
  }

  canvas.showDetail = showDetail;

  canvas.changePage = function (id, page) {
    selectedImage.page = page;
    detailVue._data.page = page;
    clearBigImages();
    loadBigImage(selectedImage);
  };

  function hideTheRest(d) {
    data.forEach(function (d2) {
      if (d2.id !== d.id) {
        d2.alpha = 0;
        d2.alpha2 = 0;
      }
    });
  }

  function showAllImages() {
    data.forEach(function (d) {
      d.alpha = d.active ? 1 : 0.2;
      d.alpha2 = d.visible ? 1 : 0;
    });
  }

  var zoomBarrierState = false;
  var lastSourceEvent = null;
  var isInIframe = window.self !== window.top;

  function zoomed() {
    lastSourceEvent = d3.event.sourceEvent;
    translate = d3.event.translate;
    scale = d3.event.scale;
    if (!startTranslate) startTranslate = translate;
    drag = startTranslate && translate !== startTranslate;

    var x1 = (-1 * translate[0]) / scale;
    var x2 = x1 + widthOuter / scale;

    if (d3.event.sourceEvent != null) {
      var sidebarOffset = Math.min(480, widthOuter * 0.4);

      if (x1 < 0) {
        translate[0] = 0;
      } else if (x2 > widthOuter + (sidebarOffset / scale)) {
        translate[0] = (widthOuter * scale - widthOuter + sidebarOffset) * -1;
      }

      zoom.translate([translate[0], translate[1]]);
      x1 = (-1 * translate[0]) / scale;
      x2 = x1 + width / scale;
    }

    if (
      zoomedToImageScale != 0 &&
      scale > zoomedToImageScale * 0.9 &&
      !zoomedToImage &&
      selectedImage &&
      selectedImage.type == "image"
    ) {
      zoomedToImage = true;
      zoom.center(null);
      zoomedToImageScale = scale;
      hideTheRest(selectedImage);
      showDetail(selectedImage);
    }

    if (zoomedToImage && zoomedToImageScale * 0.8 > scale) {
      zoomedToImage = false;
      state.lastZoomed = 0;
      showAllImages();
      clearBigImages();
      detailContainer.classed("hide", true);
    }

    timeline.update(x1, x2, scale, translate, scale1);

    if (scale > zoomBarrier && !zoomBarrierState) {
      zoomBarrierState = true;
      d3.select(".tagcloud, .crossfilter").classed("hide", true);
      d3.select(".searchbar").classed("hide", true);
      d3.select(".infobar").classed("sneak", true);
    }
    if (scale < zoomBarrier && zoomBarrierState) {
      zoomBarrierState = false;
      d3.select(".tagcloud, .crossfilter").classed("hide", false);
      d3.select(".vorbesitzerinOuter").classed("hide", false);
      d3.select(".searchbar").classed("hide", false);
    }

    stage2.scale.x = d3.event.scale;
    stage2.scale.y = d3.event.scale;
    stage2.x = d3.event.translate[0];
    stage2.y = d3.event.translate[1];

    sleep = false;
  }

  function zoomstart(d) {
    zooming = true;
    startTranslate = false;
    drag = false;
    startScale = scale;
  }

  function toScreenPoint(p) {
    var p2 = [0, 0];
    p2[0] = p[0] / scale - translate[0] / scale;
    p2[1] = p[1] / scale - height - translate[1] / scale;
    return p2;
  }

  var debounceHash = null;
  var debounceHashTime = 400;
  var userInteraction = false;

  function zoomend() {
    if (!startTranslate) return;
    
    drag = startTranslate && translate !== startTranslate;
    zooming = false;
    filterVisible();

    if (
      zoomedToImage &&
      selectedImage &&
      !selectedImage.big &&
      state.lastZoomed != selectedImage.id &&
      !state.zoomingToImage
    ) {
      loadBigImage(selectedImage, "zoom");
    }

    if (lastSourceEvent) {
      if (debounceHash) clearTimeout(debounceHash);
      debounceHash = setTimeout(function () {
        if (zooming) return;
        var hash = window.location.hash.slice(1);
        var params = new URLSearchParams(hash);

        const idsInViewport = canvas.getView();
        if (idsInViewport.length > 0) {
          params.set("ids", idsInViewport.join(","));
        } else if (zoomedToImage) {
          return;
        } else {
          params.delete("ids");
        }
        window.location.hash = params.toString().replaceAll("%2C", ",");
        userInteraction = true;
      }, debounceHashTime);
    }
  }

  canvas.onhashchange = function () {
    var hash = window.location.hash.slice(1);
    var params = new URLSearchParams(hash);

    if (params.has("ids") && !userInteraction) {
      var ids = params.get("ids").split(",");
      if (
        params.has("mode") && params.get("mode") !== state.mode.title ||
        params.has("filter") && params.get("filter") !== tags.getFilterWords().join(",") ||
        params.get("search") !== tags.getSearchTerm()
      ) {
        zoomedToImage = false;
        state.lastZoomed = 0;
        showAllImages();
        clearBigImages();
        setTimeout(function () {
          canvas.setView(ids);
        }, hashDelay);
      } else {
        canvas.setView(ids);
      }
    }

    if (!params.has("ids") && scale > 1) {
      canvas.resetZoom();
    }

    if (hash === "") {
      canvas.removeAllCustomGraphics();
      canvas.resetZoom(function () {
        tags.reset();
        utils.setMode();
        search.reset();
      });
      return;
    }

    if (params.has("filter")) {
      var filter = params.get("filter").split(",");
      tags.setFilterWords(filter);
    } else {
      tags.setFilterWords([]);
    }

    if (params.has("search")) {
      var searchTerm = params.get("search");
      if (tags.getSearchTerm() !== searchTerm) {
        tags.search(searchTerm);
        if (typeof search !== 'undefined' && search.setSearchTerm) {
          search.setSearchTerm(searchTerm);
        }
      }
    } else {
      if (tags.getSearchTerm() && tags.getSearchTerm() !== "") {
        tags.search("");
        if (typeof search !== 'undefined' && search.reset) {
          search.reset();
        }
      }
    }

    if (params.has("mode")) {
      utils.setMode(params.get("mode"));
    } else {
      utils.setMode();
    }

    if (params.has("borders")) {
      setTimeout(function () {
        var borderIds = params.get("borders").split(",");
        updateImageBorders(borderIds);
      }, params.has("filter") || params.has("mode") ? 2000 : 0);
    } else {
      canvas.removeAllBorders();
    }

    if (params.has("vector")) {
      var vectorVals = params.get("vector");
      if (annotationVectors.toString() !== vectorVals.toString()) {
        annotationVectors = vectorVals;
        canvas.drawVectors();
      }
    } else {
      canvas.removeAllVectors();
    }

    userInteraction = false;
  };

  canvas.highlight = function () {
    data.forEach(function (d) {
      d.alpha = d.highlight ? 1 : 0.2;
    });
    canvas.wakeup();
  };

  canvas.project = function () {
    ping();
    sleep = false;
    var scaleFactor = state.mode.type == "group" ? 0.9 : tsneScale[state.mode.title] || 0.5;
    data.forEach(function (d) {
      d.scaleFactor = scaleFactor;
      d.sprite.scale.x = d.scaleFactor;
      d.sprite.scale.y = d.scaleFactor;
      if (d.sprite2) {
        d.sprite2.scale.x = d.scaleFactor;
        d.sprite2.scale.y = d.scaleFactor;
      }
    });

    if (state.mode.type === "group") {
      canvas.split();
      cursorCutoff = (1 / scale1) * imageSize * 1;
    } else {
      canvas.projectTSNE();
      cursorCutoff = (1 / scale1) * imageSize * 1;
    }

    zoomedToImageScale =
      (0.8 / (x.rangeBand() / columns / width)) *
      (state.mode.type === "group" ? 1 : 0.5);
  };

  canvas.projectTSNE = function () {
    var marginBottom = -height / 2.5;

    var inactive = data.filter(function (d) { return !d.active; });
    var inactiveSize = inactive.length;
    var active = data.filter(function (d) { return d.active; });

    var dimension = Math.min(width, height) * 0.8;

    inactive.forEach(function (d, i) {
      var r = dimension / 1.4 + Math.random() * 40;
      var a = -Math.PI / 2 + (i / inactiveSize) * 2 * Math.PI;

      d.x = r * Math.cos(a) + width / 2 + margin.left;
      d.y = r * Math.sin(a) + marginBottom;
    });

    active.forEach(function (d) {
      var tsneEntry = tsneIndex[state.mode.title][d.id];
      if (tsneEntry) {
        d.x = tsneEntry[0] * dimension + width / 2 - dimension / 2 + margin.left;
        d.y = -1 * tsneEntry[1] * dimension;
      } else {
        d.alpha = 0;
        d.x = 0;
        d.y = 0;
        d.active = false;
      }
    });

    data.forEach(function (d) {
      d.x1 = d.x * scale1 + imageSize / 2;
      d.y1 = d.y * scale1 + imageSize / 2;

      if (d.sprite.position.x == 0) {
        d.sprite.position.x = d.x1;
        d.sprite.position.y = d.y1;
      }

      if (d.sprite2) {
        d.sprite2.position.x = d.x * scale2 + imageSize2 / 2;
        d.sprite2.position.y = d.y * scale2 + imageSize2 / 2;
      }
    });

    quadtree = Quadtree(data);
  };

  canvas.resetZoom = function (callback) {
    var duration = scale > 1 ? 800 : 100;
    canvas.clearMedia();

    extent = d3.extent(data, function (d) { return d.y; });
    var targetY = -bottomPadding;

    d3.select(".sidebar").classed("sneak", true);
    d3.select(".tagcloud").classed("hide", false);
    if (typeof clearBigImages === "function") clearBigImages();

    var startS = scale;
    var startT = [translate[0], translate[1]];
    var targetS = 1;
    var targetT = [0, targetY];

    var iScale = d3.interpolateNumber(startS, targetS);
    var iTranslate = d3.interpolateArray(startT, targetT);

    vizContainer
      .interrupt()
      .transition()
      .duration(duration)
      .tween("zoom", function () {
        return function (t) {
          var s = iScale(t);
          var tr = iTranslate(t);

          scale = s;
          translate = tr;
          zoom.scale(s).translate(tr);

          stage2.scale.x = s;
          stage2.scale.y = s;
          stage2.x = tr[0];
          stage2.y = tr[1];

          if (typeof timeline !== "undefined" && timeline.update) {
            var x1 = (-1 * tr[0]) / s;
            var x2 = x1 + widthOuter / s;
            timeline.update(x1, x2, s, tr, scale1);
          }

          sleep = false;
        };
      })
      .each("end", function () {
        zoomedToImage = false;
        selectedImage = null;
        state.zoomingToImage = false;
        vizContainer.style("pointer-events", "auto");
        if (callback && scale < zoomBarrier) callback();
      });
  };

  canvas.split = function () {
    var layout = state.mode.y ? stackYLayout : stackLayout;
    var active = data.filter(function (d) { return d.active; });
    layout(active, false);
    var inactive = data.filter(function (d) { return !d.active; });
    layout(inactive, true);
    quadtree = Quadtree(data);
  };

  function filterVisible() {
    var zoomScale = scale;
    if (zoomedToImage) return;

    data.forEach(function (d) {
      var p = d.sprite.position;

      var x = p.x / scale1 + translate[0] / zoomScale;
      var y = p.y / scale1 + translate[1] / zoomScale;
      var padding = 2;

      if (
        x > -padding
        && x < width / zoomScale + padding
        && y + height < height / zoomScale + padding
        && y > height * -1 - padding
      ) {
        d.visible = true;
      } else {
        d.visible = false;
      }
    });

    var visible = data.filter(function (d) { return d.visible; });

    if (visible.length < 40) {
      data.forEach(function (d) {
        if (d.visible && d.loaded && d.active) d.alpha2 = 1;
        else if (d.visible && !d.loaded && d.active) loadImagesCue.push(d);
        else d.alpha2 = 0;
      });
    } else {
      data.forEach(function (d) { d.alpha2 = 0; });
    }
  }

  function loadMiddleImage(d) {
    if (d.loaded) {
      d.alpha2 = 1;
      return;
    }
    var url = "";
    if (config.loader.textures.detail.csv) {
      url = d[config.loader.textures.detail.csv];
    } else {
      url = config.loader.textures.detail.url + "/" + d.id + ".jpg";
    }

    var texture = new PIXI.Texture.from(url);
    var sprite = new PIXI.Sprite(texture);

    var update = function () { sleep = false; };

    sprite.on("added", update);
    texture.once("update", update);

    sprite.scale.x = d.scaleFactor;
    sprite.scale.y = d.scaleFactor;
    sprite.anchor.x = 0.5;
    sprite.anchor.y = 0.5;
    sprite.position.x = d.x * scale2 + imageSize2 / 2;
    sprite.position.y = d.y * scale2 + imageSize2 / 2;
    sprite._data = d;
    stage4.addChild(sprite);
    d.sprite2 = sprite;
    d.alpha2 = d.highlight;
    d.loaded = true;
    sleep = false;
  }

  function loadBigImage(d) {
    if (!config.loader.textures.big) {
      loadMiddleImage(d);
      return;
    }

    state.lastZoomed = d.id;
    var page = d.page ? "_" + d.page : "";
    var url = "";
    if (config.loader.textures.big.csv) {
      url = d[config.loader.textures.big.csv];
    } else {
      url = config.loader.textures.big.url + "/" + d.id + page + ".jpg";
    }

    var texture = new PIXI.Texture.from(url);
    var sprite = new PIXI.Sprite(texture);

    var updateSize = function (t) {
      var size = Math.max(texture.width, texture.height);
      sprite.scale.x = sprite.scale.y = (imageSize3 / size) * d.scaleFactor;
      sleep = false;
      if (t.valid) {
        d.alpha = 0;
        d.alpha2 = 0;
      }
    };

    sprite.on("added", updateSize);
    texture.once("update", updateSize);

    if (d.imagenum) {
      sprite.on("mousemove", function (s) {
        var pos = s.data.getLocalPosition(s.currentTarget);
        s.currentTarget.cursor = pos.x > 0 ? "e-resize" : "w-resize";
      });
      sprite.on("click", function (s) {
        if (drag) return;
        s.stopPropagation();
        spriteClick = true;
        var pos = s.data.getLocalPosition(s.currentTarget);
        var dir = pos.x > 0 ? 1 : -1;
        var page = d.page + dir;
        var nextPage = page;
        if (page > d.imagenum - 1) nextPage = 0;
        if (page < 0) nextPage = d.imagenum - 1;

        canvas.changePage(d.id, nextPage);
      });
      sprite.interactive = true;
    }

    sprite.anchor.x = 0.5;
    sprite.anchor.y = 0.5;
    sprite.position.x = d.x * scale3 + imageSize3 / 2;
    sprite.position.y = d.y * scale3 + imageSize3 / 2;
    sprite._data = d;
    d.big = true;
    stage5.addChild(sprite);

    if (d._description) {
      var highResMultiplier = 4;
      var targetScreenFontSize = 32;
      var wrapWidthOnScreen = width * 0.8;

      var style = new PIXI.TextStyle({
        fontFamily: 'Lato, Arial, sans-serif',
        fontSize: targetScreenFontSize * highResMultiplier, 
        fill: '#000000',
        wordWrap: true,
        wordWrapWidth: wrapWidthOnScreen * highResMultiplier,
        align: 'center'
      });

      var descText = new PIXI.Text(d._description, style);
      descText.anchor.x = 0.5;
      descText.anchor.y = 0;
      descText.position.x = d.x * scale3 + imageSize3 / 2;

      var updateTextPosition = function() {
        var actualHeight = sprite.height || imageSize3;
        var actualWidth = sprite.width || imageSize3;
        var screenFitRatio = Math.max(actualWidth / width, actualHeight / height);
        descText.scale.set(screenFitRatio / highResMultiplier);

        var targetScreenGap = 40; 
        var gapInPixi = targetScreenGap * screenFitRatio;
        descText.position.y = (d.y * scale3 + imageSize3 / 2) + (actualHeight / 2) + gapInPixi;
        
        var textureFrames = 5;
        function settleTexturePosition() {
          sleep = false;
          if (typeof animate === "function") animate();
          if (textureFrames-- > 0) requestAnimationFrame(settleTexturePosition);
        }
        settleTexturePosition();
      };

      updateTextPosition();
      texture.once("update", updateTextPosition);
      stage5.addChild(descText);
    }
    sleep = false;
  }

  function clearBigImages() {
    while (stage5.children[0]) {
      stage5.children[0]._data.big = false;
      stage5.removeChild(stage5.children[0]);
      sleep = false;
    }
  }

  function loadImages() {
    if (zooming) return;
    if (zoomedToImage) return;

    if (loadImagesCue.length) {
      var d = loadImagesCue.pop();
      if (!d.loaded) {
        loadMiddleImage(d);
      }
    }
  }

  return canvas;
}
