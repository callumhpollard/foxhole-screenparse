var prepareItemCache = {};

// return new mat
const addCrate = async (scaledItemMat, itemSizePx) => {
  let icon = await loadImage(getImgPath('icons/menus/filtercrates.png'));
  let step1 = cv.imread(icon);
  let ret = await addExtraDecor(scaledItemMat, step1, 'botright', itemSizePx);
  step1.delete();
  return ret;
}

// return new mat
const addExtraIcon = async (scaledItemMat, item, itemSizePx) => {
  if (typeof item.extraIcon === 'undefined') {
    return scaledItemMat.clone();
  }
  let imgPath = extra_icons[item.extraIcon].imgPath;
  let icon = await loadImage(getImgPath(imgPath));
  let step1 = cv.imread(icon);
  let ret = await addExtraDecor(scaledItemMat, step1, 'topleft', itemSizePx);
  step1.delete();
  return ret;
}

// return new mat with added crate
const addExtraDecor = async (scaledItemMat, decorMat, position, itemSizePx) => {
  let step2 = new cv.Mat();
  let step3 = new cv.Mat();
  let step4 = new cv.Mat();
  let step5 = new cv.Mat();
  let emptyMask = new cv.Mat();
  // @ itemSizePx=32
  // scale to 14x14px
  const length = Math.round(14.0 / 32.0 * itemSizePx);
  let dsize = new cv.Size(length, length);
  cv.resize(decorMat, step3, dsize, 0, 0, cv.INTER_AREA);
  // px away from bottom and 1 from right
  let fillerColor = new cv.Scalar(0, 0, 0, 0);

  let padTop;
  let padLeft;
  let padBot;
  let padRight;
  if (position == 'topleft') {
    padTop = 0;
    padLeft = 0;
    padBot = itemSizePx - length;
    padRight = itemSizePx - length;
  } else if (position == 'botright') {
    padBot = Math.round(0.0 / 32.0 * itemSizePx);;
    padRight = Math.round(0.0 / 32.0 * itemSizePx);;
    padTop = itemSizePx - padBot - length;
    padLeft = itemSizePx - padRight - length;
  }
  cv.copyMakeBorder(step3, step4, 
    padTop, padBot, padLeft, padRight, 
    cv.BORDER_CONSTANT, fillerColor);
  
  // opacity 50%
  // apply : (0.5a)F + (1-0.5a)B
  let planes = new cv.MatVector();
  cv.split(step4, planes);
  // norm alpha to 0<a<1 (=> 1/256) and apply 50% opacity
  let alphaMask = new cv.Mat();
  let alphaMaskInv = new cv.Mat();
  let maxVal = new cv.Mat();
  planes.get(0).convertTo(maxVal, -1, 0, 255);
  let oneVal = new cv.Mat();
  maxVal.convertTo(oneVal, cv.CV_32F, 0, 1);
  planes.get(3).convertTo(alphaMask, cv.CV_32F, 1.0 / 256.0, 0);
  cv.subtract(oneVal, alphaMask, alphaMaskInv, new cv.Mat(), -1);
  let background1 = new cv.Mat();
  let background2 = new cv.Mat();
  let background3 = new cv.Mat();
  let background4 = new cv.Mat();
  cv.multiply(scaledItemMat, alphaMaskInv, background1, 1.0, scaledItemMat.type());
  
  // apply alpha mask to each color and add it with factor 1/3 to background
  cv.multiply(planes.get(0), alphaMask, step5, 1.0/3.0, planes.get(0).type());
  cv.add(background1, step5, background2, emptyMask, background1.type());
  cv.multiply(planes.get(1), alphaMask, step5, 1.0/3.0, planes.get(0).type());
  cv.add(background2, step5, background3, emptyMask, background1.type());
  cv.multiply(planes.get(2), alphaMask, step5, 1.0/3.0, planes.get(0).type());
  cv.add(background3, step5, background4, emptyMask, background1.type());

  step2.delete(); step3.delete(); step4.delete(); step5.delete(); emptyMask.delete();
  planes.delete(); alphaMask.delete(); alphaMaskInv.delete(); maxVal.delete(); 
  oneVal.delete(); 
  background1.delete(); background2.delete(); background3.delete();

  return background4;
}

// returns mat of processed item
const prepareItem = async (inMat, item, itemSizePx) => {
  let step = new cv.Mat();
  let dst = new cv.Mat();
  let rgbaPlanes = new cv.MatVector();
  cv.split(inMat, rgbaPlanes);
  let step2 = new cv.Mat();
  let nilVal = new cv.Mat();
  rgbaPlanes.get(0).convertTo(nilVal, -1, 0, 0);
  let maxVal = new cv.Mat();
  nilVal.convertTo(maxVal, -1, 1, 255);
  let alphaMask = new cv.Mat();
  let mask = new cv.Mat();
  let gray = new cv.Mat();
  //cv.subtract(rgbaPlanes.get(0), rgbaPlanes.get(0), step2, mask);
  //cv.add(step2, step3, 254);
  rgbaPlanes.get(3).convertTo(alphaMask, cv.CV_32F, 1.0/256.0, 0);
  // bake alpha into R
  cv.multiply(rgbaPlanes.get(0), alphaMask, step2, 1.0, rgbaPlanes.get(0).type());
  rgbaPlanes.set(0, step2);
  // bake alpha into G
  cv.multiply(rgbaPlanes.get(1), alphaMask, step2, 1.0, rgbaPlanes.get(0).type());
  rgbaPlanes.set(1, step2);
  // bake alpha into B
  cv.multiply(rgbaPlanes.get(2), alphaMask, step2, 1.0, rgbaPlanes.get(0).type());
  rgbaPlanes.set(2, step2);
  // set transparency to 255 (none)
  rgbaPlanes.set(3, maxVal);
  // merge planes
  cv.merge(rgbaPlanes, step);
  cv.cvtColor(step, gray, cv.COLOR_RGBA2GRAY, 0); 
  let dsize = new cv.Size(itemSizePx, itemSizePx);
  // You can try more different parameters
  cv.resize(gray, dst, dsize, 0, 0, cv.INTER_AREA);
  let crated = await addCrate(dst, itemSizePx);
  let extraIconed = await addExtraIcon(crated, item, itemSizePx);
  step.delete(); dst.delete(); rgbaPlanes.delete(); step2.delete(); nilVal.delete(); 
  maxVal.delete(); 
  alphaMask.delete(); 
  mask.delete(); 
  gray.delete(); 
  crated.delete();
  return extraIconed;
}

const imgmatch = async (haystackMat, needleMat) => {
  let dst = new cv.Mat();
  let mask = new cv.Mat();
  let foo = new cv.Mat();
  cv.matchTemplate(haystackMat, needleMat, dst, cv.TM_CCOEFF_NORMED, mask);
  let best = null;
  let matches = [];
  for (let i = 0; i <= 20; i++){
    let result = cv.minMaxLoc(dst, mask);
    let maxPoint = result.maxLoc;
    cv.floodFill(dst, foo, maxPoint, new cv.Scalar());
    let color = new cv.Scalar(255 - i * 10, 0, 0, 255);
    let point = new cv.Point(maxPoint.x + needleMat.cols, maxPoint.y + needleMat.rows);
    //cv.rectangle(haystackMat, maxPoint, point, color, 1, cv.LINE_8, 0);
    matches.push({
      "confidence": result.maxVal,
      "x0": maxPoint.x,
      "y0": maxPoint.y,
      "x1": maxPoint.x + needleMat.cols,
      "y1": maxPoint.y + needleMat.rows
    });
  }
  dst.delete(); mask.delete(); foo.delete(); 
  return matches;
}

const points2point = (points) => {
  const x0 = Math.min(points.x0, points.x1);
  const x1 = Math.max(points.x0, points.x1);
  const y0 = Math.min(points.y0, points.y1);
  const y1 = Math.max(points.y0, points.y1);
  const width = Math.abs(x1 - x0);
  const height = Math.abs(y1 - y0);
  return { x: x0, y: y0, width: width, height: height };
}

// expects coords of corner with smallest coords (as from points2point)
const itemCountPos = (_x0, _y0, iconSizePx) => {
  const x0 = _x0 + 1.4 * iconSizePx;
  const y0 = _y0;
  const x1 = x0 + 1.3 * iconSizePx;
  const y1 = y0 + iconSizePx;
  return { x0: x0, y0: y0, x1: x1, y1: y1 };
}

// returns nothing. Works inplace. 
const drawRect = async (matIn, x0, y0, x1, y1) => {
  let color = new cv.Scalar(0, 255, 0, 255);
  let point = new cv.Point(x0, y0);
  let size = new cv.Point(x1, y1);
  cv.rectangle(matIn, point, size, color, 1, cv.LINE_8, 0);
}

// works: tesseract --oem 0 --psm 11 -l "eng" fhq-seaport-curve1.png cmd -c tessedit_write_images=T
// returns: width an item icon should have in pixels
const ocr = async (domCanvas) => {
  const worker = Tesseract.createWorker({
    logger: m => console.debug(m)
  });

  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  const params = {
    //'tessedit_ocr_engine_mode': 0,
    //'tessedit_pageseg_mode': 11,
    'tessedit_ocr_engine_mode': Tesseract.OEM.TESSERACT_ONLY,
    'tessedit_pageseg_mode': Tesseract.PSM.SPARSE_TEXT,
    //'tessedit_char_whitelist': 'Seaport',
    // 'tessjs_create_osd': '1'
    //'tessjs_create_tsv': '1'
  };
  await worker.setParameters(params);
  const result = await worker.recognize(domCanvas);
  console.debug(result);
  console.debug(result.data.text);

  const seaportIdx = result.data.words.findIndex((word) => {
    return word.text == "Seaport";
  });
  const word = result.data.words[seaportIdx];
  const width = seaport2Icon(word.bbox.x1 - word.bbox.x0);

  const markWord = async (word) => {
    console.log(word);
    console.log("icon width should be ", seaport2Icon(word.bbox.x1 - word.bbox.x0));
    //let debugCanvas = document.getElementById('canvasImgmatch');
    let debugMat = cv.imread('canvasImgmatch');
    await drawRect(debugMat, word.bbox.x0, word.bbox.y0, word.bbox.x1, word.bbox.y1);
    cv.imshow('canvasImgmatch', debugMat);
    debugMat.delete();
  }
  await markWord(result.data.words[seaportIdx]);
  await markWord(result.data.words[seaportIdx+1]);
  await markWord(result.data.words[seaportIdx+2]);
  await markWord(result.data.words[seaportIdx+3]);
  await markWord(result.data.words[seaportIdx+4]);
  await markWord(result.data.words[seaportIdx+5]);
  await markWord(result.data.words[seaportIdx+6]);
  await worker.terminate();
  return width;
}

// https://stackoverflow.com/questions/26941168/javascript-interpolate-an-array-of-numbers
const interpolateArray = (data, fitCount) => {
  var linearInterpolate = function (before, after, atPoint) {
    return before + (after - before) * atPoint;
  };

  var newData = new Array();
  var springFactor = new Number((data.length - 1) / (fitCount - 1));
  newData[0] = data[0]; // for new allocation
  for ( var i = 1; i < fitCount - 1; i++) {
    var tmp = i * springFactor;
    var before = new Number(Math.floor(tmp)).toFixed();
    var after = new Number(Math.ceil(tmp)).toFixed();
    var atPoint = tmp - before;
    newData[i] = linearInterpolate(data[before], data[after], atPoint);
  }
  newData[fitCount - 1] = data[data.length - 1]; // for new allocation
  return newData;
}

// returns: matOut
const postprocessSeaport = async (matIn) => {
  let step = new cv.Mat();
  let step2 = new cv.Mat();
  cv.cvtColor(matIn, step, cv.COLOR_RGBA2GRAY, 0);
  //let lut = [];
  //lut += interpolateArray([0, 0], 256/2);
  //lut += interpolateArray([0, 7*(256/8)], 7*(256/8));
  //lut += interpolateArray([7*(256/8), 255], 1*(256/8));
  //console.log(lut);
  //cv.LUT(src, lut, dst);
  cv.threshold(step, step2, 0.75*256, 255, cv.THRESH_BINARY);
  //cv.threshold(step, dst, 0.65*256, 0, cv.THRESH_TOZERO);
  cv.bitwise_not(step2, step);
  step2.delete();
  return step;
}

// pixel on fhd
const seaport2Icon = (width) => {
  // icon 29?@ 1600x900,  seaport 40?
  // icon 32 @ 1920x1080, seaport 51
  // icon 43 @ 2560x1440, seaport 66
  // icon.width / seaport.width = x / width
  const f = 32.0 * width / 51.0;
  return Math.round(f);
}

// taken from https://stackoverflow.com/questions/37854355/wait-for-image-loading-to-complete-in-javascript
const loadImage = async function(imageUrl) {
    let img;
    const imageLoadPromise = new Promise(resolve => {
        img = new Image();
        img.onload = resolve;
	img.crossOrigin = "anonymous"; // without this opencv imread throws "this operation is unsecure"
        img.src = imageUrl;
    });

    await imageLoadPromise;
    return img;
}

// Borrowed from docs.opencv.org sources
const loadImageToCanvas = async function(url, domCanvas) {
  let ctx = domCanvas.getContext('2d');
  let img = await loadImage(url);
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0, img.width, img.height);
}

const clearCanvas = async (domCanvas) => {
  const context = domCanvas.getContext('2d');
  context.clearRect(0, 0, domCanvas.width, domCanvas.height);
}

const getImgPath = (imgPath) => {
  if (imgPath.startsWith('http')) {
    return imgPath;
  } else {
    return 'https://raw.githubusercontent.com/foxholetools/assets/master/dist/' + imgPath;
  }
}

// expects the stockpileBox to already been drawn into the canvasImgmatch
const countItems = async (faction, iconSizePx, stockpileBox) => {
  let tesseract = new OCR();
  await tesseract.init();
  let found = [];
  let image = cv.imread('imageSrc');
  var screenshot = new cv.Mat();
  cv.cvtColor(image, screenshot, cv.COLOR_RGBA2GRAY, 0);
  image.delete();
  let rect = new cv.Rect(
          stockpileBox.x, 
          stockpileBox.y, 
          stockpileBox.width,
          stockpileBox.height,
        );
  console.log(rect);
  let stockpileMat = screenshot.roi(rect);
  console.log('rectified');
  cv.imshow('canvasImgmatch', stockpileMat);
  screenshot.delete();
  // TODO quartering the search canvas quarters the matching time.
  //let image = cv.imread('imageSrc');
  //let origScreenshot = new cv.Mat();
  //cv.cvtColor(image, origScreenshot, cv.COLOR_RGBA2GRAY, 0);
  //let rect = new cv.Rect(
  //        720, 
  //        0, 
  //        403,
  //        1080 
  //      );
  //var screenshot = origScreenshot.roi(rect);
  // TODO try reverse lookup: align at SS, GS, BS; get fist item icon and search in icon db
  // filter items by faction to reduce amount of similar looking items
	
  for (let item of items) {
    //item = items[0];
    if (typeof item.imgPath === 'undefined') {
      continue;
    }
    if (!item.faction.includes(faction)) {
      continue;
    }

    let perfStart = performance.now();
    console.log("Searching " + item.itemName + "...");
    let icon = await loadImage(getImgPath(item.imgPath));
    let iconUnprocessedMat = cv.imread(icon);
    let iconMat = await prepareItem(iconUnprocessedMat, item, iconSizePx);
    iconUnprocessedMat.delete();
    cv.imshow('canvasItem', iconMat);
    let matches = await imgmatch(stockpileMat, iconMat);
    let perfMatched = performance.now();
    let best = matches[0];
    console.info("Confidence: " + best.confidence);
    const box = points2point(best);
    let rect = new cv.Rect(
            box.x, 
            box.y, 
            box.width,
            box.height
          );
    let matchedMat = stockpileMat.roi(rect);
    if (best.confidence < 0.9) {
      console.info("Matching: " + (perfMatched - perfStart) + "ms");
      domListAppend(item, best.confidence, iconMat, matchedMat);
      found.push({ "name": item.itemName, "count": 0 });
      continue;
    }

    const countPoints = itemCountPos(box.x, box.y, iconSizePx);
    let debugShot = cv.imread('canvasImgmatch');
    await drawRect(debugShot, best.x0, best.y0, best.x1, best.y1);
    await drawRect(debugShot, countPoints.x0, countPoints.y0, countPoints.x1, countPoints.y1);
    cv.imshow('canvasImgmatch', debugShot);
    debugShot.delete();

    const countBox = points2point(countPoints);
    rect = new cv.Rect(
            countBox.x, 
            countBox.y, 
            countBox.width,
            countBox.height
          );
    let countSmallMat = stockpileMat.roi(rect);
    let countMat = new cv.Mat();
    let dsize = new cv.Size(countBox.width*4.0, countBox.height*4.0);
    cv.resize(countSmallMat, countMat, dsize, 0, 0, cv.INTER_CUBIC);
    countSmallMat.delete();
    let itemCount = await tesseract.itemCount(mat2canvas(countMat), countPoints);
    console.log(item.itemName + ": " + itemCount);
    found.push({ "name": item.itemName, "count": itemCount });
    let perfOCRed = performance.now();
    console.info("Matching: " + (perfMatched - perfStart) + "ms, OCR: " + (perfOCRed - perfMatched) + "ms");
    domListAppend(item, best.confidence, iconMat, matchedMat, countMat, itemCount);
    iconMat.delete(); countMat.delete(); matchedMat.delete();
    //break;
  }

  stockpileMat.delete();
  console.info(found);
  return found;
};

// returns dom object of canvas
const mat2canvas = (mat) => {
  cv.imshow('canvasTmp', mat);
  return document.getElementById('canvasTmp');
}

// returns dom object of canvas
const img2canvas = (img) => {
  let canvas = document.getElementById('canvasTmp');
  let ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0, img.width, img.height);
  return canvas;
}

const domListAppend = async (item, confidence, iconRendered, iconFound, countFound, countRead) => {
  let list = document.getElementById("itemlist");
  let li = document.createElement("li");
  li.setAttribute("style", "position: inline-block;");

  let canvas = document.createElement("canvas");
  cv.imshow(canvas, iconRendered);
  li.appendChild(canvas);

  if (typeof iconFound !== 'undefined') {
    canvas = document.createElement("canvas");
    cv.imshow(canvas, iconFound);
    li.appendChild(canvas);
  }

  if (typeof countFound !== 'undefined') {
    canvas = document.createElement("canvas");
    cv.imshow(canvas, countFound);
    li.appendChild(canvas);
  }

  if (typeof countRead !== 'undefined') {
    text = document.createTextNode(" " + countRead + " crates - ");
    li.appendChild(text);
  } else {
    text = document.createTextNode(" no crates - ");
    li.appendChild(text);
  }

  text = document.createTextNode(item.itemName);
  li.appendChild(text);
  
  if (typeof confidence !== 'undefined') {
    text = document.createTextNode(" (" + confidence.toFixed(2) + ")");
    li.appendChild(text);
  }

  list.appendChild(li);
}

const printCSV = async (findings) => {
  let sortedItems = items.sort((a, b) => {
    if (typeof a.supplyPyramid === 'undefined') {
      return 1;
    }
    if (typeof b.supplyPyramid === 'undefined') {
      return -1;
    }
    return a.supplyPyramid.priority - b.supplyPyramid.priority;
  });
  let names = "";
  let crates = "";
  let pyramid = "";
  let pyramidPrio = "";
  let limit = "";
  for (const item of sortedItems) {
    let found = findings.find((finding) => { return item.itemName === finding.name; });
    if (typeof found === 'undefined') {
      continue;
    }
    names += "" + found.name + "\n";
    crates += "" + found.count + "\n";
    if (typeof item.supplyPyramid === 'undefined') {
      pyramid += "\n";
      pyramidPrio += "\n";
    } else {
      pyramid += "" + item.supplyPyramid.cratesIdeal + "\n";
      pyramidPrio += "" + item.supplyPyramid.priority + "\n";
    }
    if (typeof item.stockpileLimitPrivate === 'undefined') {
      limit += "\n";
    } else {
      limit += "" + item.stockpileLimitPrivate + "\n";
    }
  }
  document.getElementById('preformattedNames').textContent = names;
  document.getElementById('preformattedCrates').textContent = crates;
  document.getElementById('preformattedPyramid').textContent = pyramid;
  document.getElementById('preformattedPyramidPriority').textContent = pyramidPrio;
  document.getElementById('preformattedLimit').textContent = limit;
}

const removeAllChildNodes = (parent) => {
  while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }
}

const getFaction = async () => {
  if (document.getElementById('colonialButton').checked) {
    return 'colonial';
  } else if (document.getElementById('wardenButton').checked) {
    return 'warden';
  }
}

const run = async () => {
  console.log("run");
  removeAllChildNodes(document.getElementById('itemlist'));
  removeAllChildNodes(document.getElementById('preformattedNames'));
  removeAllChildNodes(document.getElementById('preformattedCrates'));
  removeAllChildNodes(document.getElementById('preformattedPyramid'));
  removeAllChildNodes(document.getElementById('preformattedPyramidPriority'));
  removeAllChildNodes(document.getElementById('preformattedLimit'));
  await clearCanvas(document.getElementById('canvasImgmatch'));
  //var width = null;
  //if (false) {
  //  let src = cv.imread('imageSrc');
  //  let canvasOCRMat = await postprocessSeaport(src);
  //  cv.imshow('canvasImgmatch', src);
  //  src.delete();
  //  await drawRect(canvasOCRMat, 90, 90, 100, 100);
  //  let perfStart = performance.now();
  //  width = await ocr(mat2canvas(canvasOCRMat));
  //  canvasOCRMat.delete();
  //  let perfOCRed = performance.now();
  //  console.info("Seaport OCR: " + (perfOCRed - perfStart) + "ms");
  //} else {
  //  width = 32; // 1920x1080
  //  //width = 43; // 2560x1440
  //  width = 27;
  //}
  let cal = await calibrate();
  if (cal == null) {
    console.warn("Width is null");
    return;
  }
  console.warn('calibration returned itemSizePx ', cal.itemSizePx);
  let faction = await getFaction();
  let findings = await countItems(faction, cal.itemSizePx, cal.stockpileBox);
  await printCSV(findings);
}

const calibrateFind = async (screenshotMat, itemName, iconSizePx) => {
    //let item = items.find((item) => { return item.itemName == 'Soldier Supplies'; });
    let item = items.find((item) => { return item.itemName == itemName; });
    console.log("Searching " + item.itemName + " at " + iconSizePx + "px...");
    let icon = await loadImage(getImgPath(item.imgPath));
    let iconUnprocessedMat = cv.imread(icon);
    let iconMat = await prepareItem(iconUnprocessedMat, item, iconSizePx);
    iconUnprocessedMat.delete();
    cv.imshow('canvasItem', iconMat);
    let matches = await imgmatch(screenshotMat, iconMat);
    let perfMatched = performance.now();
    let best = matches[0];
    console.info("Confidence: " + best.confidence);

    //await drawRect(debugShot, best.x0, best.y0, best.x1, best.y1);
    //cv.imshow('canvasImgmatch', debugShot);
  return best;
}

const calibrateFindMax = async (screenshot, itemName, from, to, step) => {
  let maxC = 0.0;
  let maxPx = 0;
  let best = null;
  for (let iconSizePx = from; iconSizePx <= to; iconSizePx += step) {
    //console.log('testing px size ', iconSizePx);
    let current = await calibrateFind(screenshot, itemName, iconSizePx);
    if (current.confidence > maxC) {
      maxC = current.confidence;
      maxPx = iconSizePx;
      best = current;
    }
  }
  best['iconSizePx'] = maxPx;
  return best;
}

const calibrate = async () => {
  let image = cv.imread('imageSrc');
  var screenshot = new cv.Mat();
  cv.cvtColor(image, screenshot, cv.COLOR_RGBA2GRAY, 0);
  image.delete();
  const coarse = 4;
  // 7 coarse searches
  let shirt1 = await calibrateFindMax(screenshot, 'Soldier Supplies', 25, 50, coarse);
  const box = points2point(shirt1);
  let rect = new cv.Rect(
          box.x - box.height, 
          box.y - box.width, 
          box.width * 15.0,
          box.height * 3.0,
        );
  let croppedMat = screenshot.roi(rect);
  // 7 fine searches
  let shirt2 = await calibrateFindMax(croppedMat, 'Soldier Supplies', 
    shirt1.iconSizePx - coarse + 1, 
    shirt1.iconSizePx + coarse - 1, 
    1);
  let bsups = await calibrateFindMax(croppedMat, 'Bunker Supplies', 
    shirt2.iconSizePx - coarse + 1, 
    shirt2.iconSizePx + coarse - 1,
    1);

  let ydiff = 
    (bsups.y0 + bsups.y1) / 2.0 - 
    (shirt2.y0 + shirt2.y1) / 2.0;
  ydiff = Math.abs(ydiff);
  let xdiff = 
    (bsups.x0 + bsups.x1) / 2.0 - 
    (shirt2.x0 + shirt2.x1) / 2.0;
  if (ydiff > 1 || shirt2.confidence < 0.8) {
    window.alert('Could not find stockpile on screenshot. (ydiff ' + ydiff + ', sconf ' + shirt2.confidence + ')');
    croppedMat.delete();
    screenshot.delete();
    return null;
  }
  console.log(shirt2);
  console.log(bsups);
  console.log('distance px y ' + ydiff + ' x ' + xdiff);
  let itemSizePx = 32.0 / 196.0 * xdiff; // 32px at a=196 (1080p)
  console.log('calculated iconSizePx ' + itemSizePx);
  rect.height = screenshot.rows - rect.y // till the bottom
  croppedMat.delete();
  screenshot.delete();
  return {
    'itemSizePx': Math.round(itemSizePx),
    'stockpileBox': rect,
  };
}
