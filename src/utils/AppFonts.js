import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 360;

const { width, height } = Dimensions.get('window');
const [shortDimension, longDimension] = width < height ? [width, height] : [height, width];

// Default guideline sizes are based on standard ~5" screen mobile device
const guidelineBaseWidth = 412;
const guidelineBaseHeight = 868;

export function normalize(size) {
  let newSize = '';
  newSize = size * (SCREEN_WIDTH / 375);
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

export function normalizeWidth(size) {
  let newSize = '';
  newSize = size * (SCREEN_WIDTH / 412);
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

export function normalizeHeight(size) {
  let newSize = '';
  newSize = size * (SCREEN_HEIGHT / 910);
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

export function horizontalscale(size) {
  return (shortDimension / guidelineBaseWidth) * size;
}
export function verticalScale(size) {
  return (longDimension / guidelineBaseHeight) * size;
}
export function moderateScale(size, factor = 0.5) {
  return size + (scale(size) - size) * factor;
}
export function moderateVerticalScale(size, factor = 0.5) {
  return size + (verticalScale(size) - size) * factor;
}
