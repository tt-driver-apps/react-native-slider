/* @flow */
'use strict';

import React, { PureComponent } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  Text as RNText,
} from 'react-native';
import PropTypes from 'prop-types';

type ThumbState = {
  allMeasured: boolean;
  fadeAnim: any;
}
type ThumbProps = {
  value: number;
  thumbTintColor: string;
  style: any;
  TextComponent: RNText;
}
export default class Thumb extends PureComponent<ThumbProps, ThumbState> {
  _timeoutID: ?Object = null;

  static propTypes = {
    value: PropTypes.number,
    thumbTintColor: PropTypes.string,
    style: PropTypes.object,
    TextComponent: PropTypes.any
  };

  static defaultProps = {
    value: 0,
    thumbTintColor: '#343434',
    style: {},
    TextComponent: RNText
  };

  state = {
    allMeasured: false,
    fadeAnim: new Animated.Value(0),
  };

  press(): void {
    Animated.timing(
      this.state.fadeAnim,
      {
        toValue: 1,
        duration: 500,
      }
    ).start();
  }

  release(): void {
    this._timeoutID = setTimeout(() =>  
      Animated.timing(
        this.state.fadeAnim,
        {
          toValue: 0,
          duration: 500,
        }
      ).start(), 
    0);
  }

  componentWillUnmount() {
    if (this._timeoutID != null) {
      clearTimeout(this._timeoutID);
    }
  } 

  render() {
    const { fadeAnim } = this.state;
    const {
      value,
      thumbTintColor,
      style,
      TextComponent,
    } = this.props;

    return (
      <Animated.View style={[styles.bubble, style, { backgroundColor: thumbTintColor, opacity: fadeAnim }]} >
        <TextComponent style={styles.percentage}>{`${value}%`}</TextComponent> 
        <View style={[styles.triangle, styles.arrowDown, { borderTopColor: thumbTintColor }]}/>
      </Animated.View>
    );
  }
}

const styles = StyleSheet.create({
  triangle: {
    top: 2,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
  },
  arrowDown: {
    borderTopWidth: 8,
    borderRightWidth: 6,
    borderBottomWidth: 0,
    borderLeftWidth: 6,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  percentage: { 
    textAlign: 'center', 
    color: 'white', 
    paddingTop: 9, 
    fontSize: 16 
  },
  bubble: { 
    width: 50, 
    height: 24, 
    bottom: 50, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center',
    left: -14,
  }
});
