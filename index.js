const fs = require("fs");
const { Readable } = require("stream");

const Jimp = require("jimp");
const path = require("path");

// const Jimp = require("jimp");

// Jimp.read("./data/Candela_m1.10/Candela_m1.10_000000.png").then((i) => {
//   i.scanQuiet();
// });
// return;

// Modify in place img1
const moveTowards = (img1, img2, stepSize = 5) => {
  // res = src + Min( Abs( ovr - src ), step ) * Sign( ovr - src )

  img1.scanQuiet(
    0,
    0,
    img1.bitmap.width,
    img1.bitmap.height,
    function (x, y, idx) {
      // x, y is the position of this pixel on the image
      // idx is the position start position of this rgba tuple in the bitmap Buffer
      // this is the image
      const src = this.bitmap.data[idx];
      const ovr = img2.bitmap.data[img2.getPixelIndex(x, y)];

      const sign = ovr > src ? 1 : -1;
      let absDifference = sign > 0 ? ovr - src : src - ovr;
      absDifference = stepSize < absDifference ? stepSize : absDifference;

      const pixel = sign > 0 ? src + absDifference : src - absDifference;

      this.bitmap.data[idx] = pixel;
      this.bitmap.data[idx + 1] = pixel;
      this.bitmap.data[idx + 2] = pixel;
    }
  );

  return img1;
};

const differenceThreshold = (img1, img2, threshold = 15) => {
  img1.scanQuiet(
    0,
    0,
    img1.bitmap.width,
    img1.bitmap.height,
    function (x, y, idx) {
      const src = this.bitmap.data[idx];
      const ovr = img2.bitmap.data[img2.getPixelIndex(x, y)];

      const difference = src >= ovr ? src - ovr : ovr - src;
      const pixel = difference > threshold ? 255 : 0;

      this.bitmap.data[idx] = pixel;
      this.bitmap.data[idx + 1] = pixel;
      this.bitmap.data[idx + 2] = pixel;
    }
  );
  return img1;
};

const mergeRed = (img1, img2 /* grayscale */) => {
  img1.scanQuiet(
    0,
    0,
    img1.bitmap.width,
    img1.bitmap.height,
    function (x, y, idx) {
      const src = this.bitmap.data[idx];
      const ovr = img2.bitmap.data[img2.getPixelIndex(x, y)];

      const red_pixel = src > ovr ? src : ovr;

      this.bitmap.data[idx] = red_pixel;
    }
  );
  return img1;
};

const imagesDir = process.argv[2];

const entries = fs.readdirSync(imagesDir);

const motionDetector = () => {
  const state = {
    background: null,
    counter: 0,
  };

  const processFrame = (frame) => {
    const currentFrame = frame.clone().grayscale();

    if (!state.background) {
      state.background = currentFrame;
      return null;
    }

    state.counter += 1;

    if (state.counter === 2) {
      state.background = moveTowards(state.background, currentFrame);
      state.counter = 0;
    }
    return differenceThreshold(currentFrame, state.background);
  };

  return {
    processFrame,
  };
};

function* generate(entries) {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    yield Jimp.read(path.resolve(imagesDir, entry)).then((img) => ({
      img,
      path: entry,
    }));
  }
}

const readable = Readable.from(generate(entries.sort()));

const motion = motionDetector();

readable.on("data", ({ img: frame, path: imgPath }) => {
  // console.log(chunk);
  const motionFrame = motion.processFrame(frame);

  if (motionFrame) {
    const newFrame = mergeRed(frame, motionFrame);
    const newPath = path.resolve("./out", imgPath);
    console.log("witing", newPath);
    newFrame.write(newPath);
  }
});
