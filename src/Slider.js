/* @flow */
'use strict';

import React, { PureComponent } from 'react';

import {
  Animated,
  Image,
  StyleSheet,
  PanResponder,
  View,
  Easing,
  ViewPropTypes,
  I18nManager,
  PanResponderInstance,
  NativeModules,
  LayoutAnimation,
} from 'react-native';
import PropTypes from 'prop-types';
import Bubble from './Bubble';

const { UIManager } = NativeModules;

UIManager.setLayoutAnimationEnabledExperimental &&
  UIManager.setLayoutAnimationEnabledExperimental(true);

const TRACK_SIZE = 4;

function Rect(x, y, width, height) {
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height;
}

Rect.prototype.containsPoint = function(x, y) {
  return (
    x >= this.x &&
    y >= this.y &&
    x <= this.x + this.width &&
    y <= this.y + this.height
  );
};

const DEFAULT_ANIMATION_CONFIGS = {
  spring: {
    friction: 7,
    tension: 100,
  },
  timing: {
    duration: 150,
    easing: Easing.inOut(Easing.ease),
    delay: 0,
  },
  animationConfig: {}
};

type SliderState = {
  containerSize: WidthAndHeight;
  trackSize: WidthAndHeight;
  thumbSize: WidthAndHeight;
  allMeasured: boolean;
  value: any;
  thumbTouchSize: WidthAndHeight;
  animThumbSize: any;
}
type SliderProps = {
  value: number;
  disabled?: boolean;
  minimumValue: number;
  maximumValue: number;
  step: number;
  minimumTrackTintColor: string;
  maximumTrackTintColor: string;
  thumbTintColor: string;
  onValueChange?: (newValue: number) => any | null;
  onSlidingStart?: (number) => number;
  onSlidingComplete?: (number) => number;
  style?: ?any,
  styles?: ?any;
  trackStyle?: ?any,
  thumbImage?: ?any;
  animateTransitions: ?boolean;
  animationType: 'spring' | 'timing';
  animationConfig?: ?any,
  TextComponent: any;
}

type WidthAndHeight = {
  width: number;
  height: number;
}

export default class Slider extends PureComponent<SliderProps, SliderState> {
  _panResponder: PanResponderInstance;
  _previousLeft: number;
  _containerSize: WidthAndHeight;
  _trackSize: WidthAndHeight;
  _thumbSize: WidthAndHeight;
  _bubble: Bubble;
  isMoving: boolean = false;
  isPressed: boolean = false;

  static propTypes = {
    /**
     * Initial value of the slider. The value should be between minimumValue
     * and maximumValue, which default to 0 and 1 respectively.
     * Default value is 0.
     *
     * *This is not a controlled component*, e.g. if you don't update
     * the value, the component won't be reset to its inital value.
     */
    value: PropTypes.number,

    /**
     * If true the user won't be able to move the slider.
     * Default value is false.
     */
    disabled: PropTypes.bool,

    /**
     * Initial minimum value of the slider. Default value is 0.
     */
    minimumValue: PropTypes.number,

    /**
     * Initial maximum value of the slider. Default value is 1.
     */
    maximumValue: PropTypes.number,

    /**
     * Step value of the slider. The value should be between 0 and
     * (maximumValue - minimumValue). Default value is 0.
     */
    step: PropTypes.number,

    /**
     * The color used for the track to the left of the button. Overrides the
     * default blue gradient image.
     */
    minimumTrackTintColor: PropTypes.string,

    /**
     * The color used for the track to the right of the button. Overrides the
     * default blue gradient image.
     */
    maximumTrackTintColor: PropTypes.string,

    /**
     * The color used for the thumb.
     */
    thumbTintColor: PropTypes.string,

    /**
     * Callback continuously called while the user is dragging the slider.
     */
    onValueChange: PropTypes.func,

    /**
     * Callback called when the user starts changing the value (e.g. when
     * the slider is pressed).
     */
    onSlidingStart: PropTypes.func,

    /**
     * Callback called when the user finishes changing the value (e.g. when
     * the slider is released).
     */
    onSlidingComplete: PropTypes.func,

    /**
     * The style applied to the slider container.
     */
    style: ViewPropTypes.style,

    /**
     * The style applied to the track.
     */
    trackStyle: ViewPropTypes.style,
    /**
     * Sets an image for the thumb.
     */
    thumbImage: Image.propTypes.source,

    /**
     * Set to true to animate values with default 'timing' animation type
     */
    animateTransitions: PropTypes.bool,

    /**
     * Custom Animation type. 'spring' or 'timing'.
     */
    animationType: PropTypes.oneOf(['spring', 'timing']),

    /**
     * Used to configure the animation parameters.  These are the same parameters in the Animated library.
     */
    animationConfig: PropTypes.object,

    TextComponent: PropTypes.any,
  };

  static defaultProps = {
    value: 0,
    minimumValue: 0,
    maximumValue: 1,
    step: 0,
    minimumTrackTintColor: '#3f3f3f',
    maximumTrackTintColor: '#b3b3b3',
    thumbTintColor: '#343434',
    animationType: 'timing',
  };

  state = {
    containerSize: { width: 0, height: 0 },
    trackSize: { width: 0, height: 0 },
    thumbSize: { width: 14, height: 14 },
    allMeasured: false,
    value: new Animated.Value(this.props.value),
    animThumbSize: 14,
    showBubble: false,
    thumbTouchSize: { width: 14, height: 14 },
  };

  constructor(props: SliderProps) {
    super(props);

    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: this._handleStartShouldSetPanResponder,
      onMoveShouldSetPanResponder: this._handleMoveShouldSetPanResponder,
      onPanResponderGrant: this._handlePanResponderGrant,
      onPanResponderMove: this._handlePanResponderMove,
      onPanResponderRelease: this._handlePanResponderEnd,
      onPanResponderTerminationRequest: this._handlePanResponderRequestEnd,
      onPanResponderTerminate: this._handlePanResponderEnd,
    });
  }

  componentDidUpdate(prevProps: SliderProps) {
    const prevValue = prevProps.value;
    if (this.props.value !== prevValue) {
      this._setCurrentValueAnimated(this.props.value); 
      if (this.isMoving) {
        if (!this.isPressed) {
          this._bubble.press();
          this.isPressed = true;
        }
      }
      if(!this.isMoving) {
        this._fireChangeEvent('onSlidingComplete');
      }
    }
  }

  _getPropsForComponentUpdate(props) {
    const {
      ...otherProps
    } = props;

    return otherProps;
  }

  _handleStartShouldSetPanResponder = (e: Object /* gestureState: Object */): boolean => this._thumbHitTest(e);

  _handleMoveShouldSetPanResponder(): boolean {
    // Should we become active when the user moves a touch over the thumb?
    return false;
  }

  _handlePanResponderGrant = () => {
    
    if (!this.isMoving) {
      this.isMoving = true;
    }
    this._previousLeft = this._getThumbLeft(this._getCurrentValue());
    this.changeThumSize(24);
    this._fireChangeEvent('onSlidingStart');
  };

  _handlePanResponderMove = (e: Object, gestureState: Object) => {
    if (this.props.disabled) {
      return;
    }

    const _value = this._getValue(gestureState);

    if (_value !== this.state.value._value) {
      this._setCurrentValue(_value);
      this._fireChangeEvent('onValueChange');
    }
  };

  _handlePanResponderRequestEnd() {
    // Should we allow another component to take over this pan?
    return false;
  }

  _handlePanResponderEnd = (e: Object, gestureState: Object) => {
    if (this.props.disabled) {
      return;
    }

    this._setCurrentValue(this._getValue(gestureState));
    this._fireChangeEvent('onSlidingComplete');
    this._bubble.release();
    this.changeThumSize(16);
    if (this.isMoving) {
      this.isMoving = false;
      this.isPressed = false;
    }
  };

  _measureContainer = (x: Object) => this._handleMeasure('containerSize', x);

  _measureTrack = (x: Object) => this._handleMeasure('trackSize', x);

  _measureThumb = (x: Object) => this._handleMeasure('thumbSize', x);

  _handleMeasure = (name: string, x: Object) => {
    const { width, height } = x.nativeEvent.layout;
    const size = { width, height };

    const storeName = `_${name}`;
    // $FlowFixMe
    const currentSize = this[storeName];
    if (
      currentSize &&
      width === currentSize.width &&
      height === currentSize.height
    ) {
      return;
    }
    // $FlowFixMe
    this[storeName] = size;

    if (this._containerSize && this._trackSize && this._thumbSize) {
      this.setState({
        containerSize: this._containerSize,
        trackSize: this._trackSize,
        thumbSize: this._thumbSize,
        allMeasured: true,
      });
    }
  };

  _getRatio = (value: number) => (value - this.props.minimumValue) / (this.props.maximumValue - this.props.minimumValue);

  _getThumbLeft = (value: number) => {
    const nonRtlRatio = this._getRatio(value);
    const ratio = I18nManager.isRTL ? 1 - nonRtlRatio : nonRtlRatio;
    return (
      ratio * (this.state.containerSize.width - this.state.thumbSize.width)
    );
  };

  _getValue = (gestureState: Object) => {
    const length = this.state.containerSize.width - this.state.thumbSize.width;
    const thumbLeft = this._previousLeft + gestureState.dx;

    const nonRtlRatio = thumbLeft / length;
    const ratio = I18nManager.isRTL ? 1 - nonRtlRatio : nonRtlRatio;

    if (this.props.step) {
      return Math.max(
        this.props.minimumValue,
        Math.min(
          this.props.maximumValue,
          this.props.minimumValue +
            Math.round(
              ratio *
                (this.props.maximumValue - this.props.minimumValue) /
                this.props.step,
            ) *
              this.props.step,
        ),
      );
    }
    return Math.max(
      this.props.minimumValue,
      Math.min(
        this.props.maximumValue,
        ratio * (this.props.maximumValue - this.props.minimumValue) +
          this.props.minimumValue,
      ),
    );
  };

  _getCurrentValue = () => this.state.value.__getValue();

  _setCurrentValue = (value: number) => this.state.value.setValue(value);

  _setCurrentValueAnimated = (value: number) => {
    const animationType = this.props.animationType;
    const animationConfig = Object.assign(
      {},
      DEFAULT_ANIMATION_CONFIGS[animationType],
      this.props.animationConfig,
      {
        toValue: value
      },
    );

    Animated[animationType](this.state.value, animationConfig).start();
    if (!this.isMoving) {
      this._bubble.pressAndRelesase()
    } 
  };

  _fireChangeEvent = (event: string): any => {
    if (this.props[event]) {
      this.props[event](this._getCurrentValue());
    }
  };

  _getTouchOverflowSize = () => {
    const { thumbTouchSize, thumbSize, containerSize, allMeasured } = this.state;

    const size = {};

    if (allMeasured === true) {
      size.width = Math.max(
        0,
        thumbTouchSize.width - thumbSize.width,
      );
      size.height = Math.max(
        0,
        thumbTouchSize.height - containerSize.height,
      );
    }

    return size;
  };

  _getTouchOverflowStyle = () => {
    const { width, height } = this._getTouchOverflowSize();

    const touchOverflowStyle = {};
    if (width !== undefined && height !== undefined) {
      const verticalMargin = -height / 2;
      touchOverflowStyle.marginTop = verticalMargin;
      touchOverflowStyle.marginBottom = verticalMargin;

      const horizontalMargin = -width / 2;
      touchOverflowStyle.marginLeft = horizontalMargin;
      touchOverflowStyle.marginRight = horizontalMargin;
    }

    return touchOverflowStyle;
  };

  _thumbHitTest = (e: Object) => {
    const nativeEvent = e.nativeEvent;
    const thumbTouchRect = this._getThumbTouchRect();
    
    this._setCurrentValue(Math.floor(100 * nativeEvent.locationX / this.state.containerSize.width));
    this._fireChangeEvent('onValueChange');

    return thumbTouchRect.containsPoint(
      nativeEvent.locationX,
      nativeEvent.locationY,
    );
  };

  _getThumbTouchRect = () => {
    const { thumbSize, thumbTouchSize, containerSize } = this.state;
    const touchOverflowSize = this._getTouchOverflowSize();

    return new Rect(
      touchOverflowSize.width / 2 +
        this._getThumbLeft(this._getCurrentValue()) +
        (thumbSize.width - thumbTouchSize.width) / 2,
      touchOverflowSize.height / 2 +
        (containerSize.height - thumbTouchSize.height) / 2,
      thumbTouchSize.width,
      thumbTouchSize.height,
    );
  };

  changeThumSize = (size: number) => {
    LayoutAnimation.spring();
    this.setState({ animThumbSize: size });
  }

  render() {
    const {
      minimumValue,
      maximumValue,
      minimumTrackTintColor,
      maximumTrackTintColor,
      thumbTintColor,
      styles,
      style,
      trackStyle,
      TextComponent,
      ...other
    } = this.props;
    const {
      value,
      containerSize,
      thumbSize,
      animThumbSize,
    } = this.state;

    const thumbLeft = value.interpolate({
      inputRange: [minimumValue, maximumValue],
      outputRange: I18nManager.isRTL
        ? [0, -(containerSize.width - thumbSize.width)]
        : [0, containerSize.width - thumbSize.width],
    });

    const minimumTrackWidth = value.interpolate({
      inputRange: [minimumValue, maximumValue],
      outputRange: [0, containerSize.width - thumbSize.width],
    });

    const minimumTrackStyle = {
      position: 'absolute',
      width: Animated.add(minimumTrackWidth, thumbSize.width / 2),
      backgroundColor: minimumTrackTintColor,
    };

    const touchOverflowStyle = this._getTouchOverflowStyle();
    
    return (
      <View
        {...other}
        style={[defaultStyles.container, style, styles]}
        onLayout={this._measureContainer}
      >
        <View
          style={[
            { backgroundColor: maximumTrackTintColor },
            defaultStyles.track,
            trackStyle,
            styles,
          ]}
          renderToHardwareTextureAndroid={true}
          onLayout={this._measureTrack}
        />
        <Animated.View
          renderToHardwareTextureAndroid={true}
          style={[defaultStyles.track, trackStyle, minimumTrackStyle, styles]}
        />
        <Animated.View
          onLayout={this._measureThumb}
          renderToHardwareTextureAndroid={true}
          style={[
            { backgroundColor: thumbTintColor },
            defaultStyles.thumb,
            styles,
            {
              borderRadius: animThumbSize / 2,
              transform: [{ translateX: thumbLeft }, { translateY: 0 }],
            },
          ]}
        >
          <View style={{ width: animThumbSize, height: animThumbSize, borderRadius: animThumbSize / 2}}/>
        </Animated.View>
        <View
          renderToHardwareTextureAndroid={true}
          style={[defaultStyles.touchArea, touchOverflowStyle]}
          {...this._panResponder.panHandlers}
        />
       <Bubble 
          ref={(bubble: any) => this._bubble = bubble}
          value={this.props.value}
          thumbTintColor={thumbTintColor}
          style={[{
            position: 'absolute',
            transform: [{ translateX: thumbLeft }, { translateY: 0 }],
          }, 
          this.props.value < 1 ? {display: 'none'} : {},
          ]}
          TextComponent={TextComponent}
        />
      </View>
    );
  }

}

const defaultStyles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_SIZE,
    borderRadius: TRACK_SIZE / 2,
  },
  thumb: {
    position: 'absolute',
  },
  touchArea: {
    position: 'absolute',
    backgroundColor: 'transparent',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
