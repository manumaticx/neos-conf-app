import React, { Component } from "react";
import PropTypes from "prop-types";
import {
  Animated,
  AppState,
  Dimensions,
  LayoutAnimation,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import moment from "moment-timezone";
import style from "./style";
import { renderItem, keyExtractor } from "./listRendering";
import Break from "./components/Break";
import Talk from "./components/Talk";
import { TIME_FORMAT } from "../../constants";

import { ScheduleTalk } from "../../types";

import talks, {
  getNextTalkFromIndex,
  getPreviousTalkFromIndex
} from "../../data/talks";
import Navbar from "../../components/Navbar";
import ListTitle from "../../components/ListTitle";
import Scene from "../../components/Scene";

import NowButton from "./components/NowButton";
import SplashScreen from "./components/SplashScreen";

export default class Schedule extends Component {
  static propTypes = {
    talks: PropTypes.arrayOf(ScheduleTalk),
    navigation: PropTypes.object.isRequired
  };
  static defaultProps = { talks: talks };

  constructor(props) {
    super(props);

    const dataBlob = {};
    const sectionIDs = [];
    const rowIDs = [];
    let sectionIndex = 0;

    props.talks.forEach(talk => {
      const sID = moment.tz(talk.time.start, "Europe/Berlin").format("dddd");

      // create new section and initialize empty array for section index
      if (!dataBlob[sID]) {
        sectionIDs.push(sID);
        rowIDs[sectionIndex] = [];
        sectionIndex++;
        dataBlob[sID] = sID;
      }

      rowIDs[rowIDs.length - 1].push(talk.id);
      dataBlob[sID + ":" + talk.id] = talk;
    });

    this.state = {
      scrollY: new Animated.Value(0),
      now: new Date()
    };

    if (Platform.OS === "ios") {
      // This isn't relevant on Android.
      this.scrollYListener = this.state.scrollY.addListener(({ value }) => {
        if (value > 120) {
          StatusBar.setBarStyle("default", true);
          StatusBar.setHidden(false, true);
        } else if (value < 80) {
          StatusBar.setBarStyle("light-content", true);
          StatusBar.setHidden(false, true);
        } else {
          StatusBar.setHidden(true, true);
        }
      });
    }
  }
  componentDidMount() {
    AppState.addEventListener("change", this.handleAppStateChange);

    // Update the schedule once a minute.
    this.interval = setInterval(
      () => {
        this.setState({ now: new Date() });
      },
      60000 // Once a minute
    );
  }
  componentWillUnmount() {
    AppState.removeEventListener("change", this.handleAppStateChange);
    if (this.scrollYListener)
      this.state.scrollY.removeListener(this.scrollYListener);

    if (this.interval) {
      clearInterval(this.interval);
      delete this.interval;
    }
  }

  handleAppStateChange = nextAppState => {
    // update the current time when the app comes into the foreground
    if (nextAppState === "active") {
      this.setState({ now: new Date() });
    }
  };
  handleNavigatorWillFocus = (event: any) => {
    const { scene } = event.data.route;

    if (scene === "Schedule" && this.state.scrollY._value < 120) {
      StatusBar.setBarStyle("light-content", true);
    }

    this.setState({ now: new Date() });
  };
  gotoEventInfo = () => {
    StatusBar.setBarStyle("default", true);
    this.props.navigation.navigate("Info");
  };

  scrolltoActiveTalk = () => {
    const { activeTalkLayout } = this.state;
    if (!activeTalkLayout) return;
    const sceneHeight = Dimensions.get("window").height;
    const maxScroll = contentLength - (sceneHeight + theme.navbar.height);
    const scrollToY =
      maxScroll < activeTalkLayout.position
        ? maxScroll
        : activeTalkLayout.position;

    this.refs.listview.scrollTo({
      y: scrollToY,
      animated: true
    });
  };
  toggleNowButton(showNowButton: boolean) {
    LayoutAnimation.easeInEaseOut();
    this.setState({ showNowButton });
  }

  _keyExtractor = (talk, index) => index;
  _renderItem = ({ item, index, now }) => {
    if (item.isBreak) {
      return (
        <Break
          startTime={moment.tz(item.time, "Europe/Berlin").format(TIME_FORMAT)}
          status={"present"}
          title={item.title}
        />
      );
    }

    const onPress = () => {
      StatusBar.setBarStyle("default", true);

      this.props.navigation.navigate("Talk", {
        talkIndex: index
      });
    };

    return (
      <Talk
        keynote={item.keynote}
        lightning={item.lightning}
        speakers={item.speakers}
        startTime={moment.tz(item.time, "Europe/Berlin").format(TIME_FORMAT)}
        status={"present"}
        title={item.title}
        onPress={onPress}
      />
    );
  };

  render() {
    const { navigation, talks } = this.props;
    const { dataSource, scrollY, showNowButton } = this.state;

    const isAndroid = Platform.OS === "android";

    const navbarTop = scrollY.interpolate({
      inputRange: [80, 120],
      outputRange: [-64, 0],
      extrapolate: "clamp"
    });

    const splashTop = scrollY.interpolate({
      inputRange: [-200, 400],
      outputRange: [200, -400],
      extrapolate: "clamp"
    });

    const renderFooter = () => (
      <TouchableOpacity
        key="footer"
        onPress={this.gotoEventInfo}
        activeOpacity={0.75}
      >
        <Text style={style.link}>Event Info</Text>
      </TouchableOpacity>
    );

    return (
      <Scene>
        <SplashScreen
          onLogoPress={this.gotoEventInfo}
          style={{ top: splashTop }}
        />

        <Animated.View style={[style.navbar, { top: navbarTop }]}>
          <Navbar
            title="Schedule"
            rightButtonIconName={isAndroid ? "md-information-circle" : null}
            rightButtonText={!isAndroid ? "About" : null}
            rightButtonOnPress={this.gotoEventInfo}
          />
        </Animated.View>

        {/* Spacer for the headings to stick correctly */}
        <View style={style.spacer} />

        <FlatList
          data={talks}
          keyExtractor={this._keyExtractor}
          extraData={{ now: this.state.now }}
          ref="listview"
          /* we render all items at once */ initialNumToRender={100}
          renderItem={this._renderItem}
          ListHeaderComponent={<View key="spacer" style={{ height: 190 }} />}
          onScroll={Animated.event([
            {
              nativeEvent: {
                contentOffset: {
                  y: scrollY
                }
              }
            }
          ])}
        />

        {showNowButton && <NowButton onPress={this.scrolltoActiveTalk} />}
      </Scene>
    );
  }
}

function getTalkStatus(startTime, endTime) {
  const now = moment.tz("Europe/Berlin");

  if (now.isBetween(startTime, endTime)) {
    return "  ";
  } else if (now.isBefore(startTime)) {
    return "future";
  }

  return "past";
}

/*
renderRow={talk => {
            const status = getTalkStatus(talk.time.start, talk.time.end);
            const onLayout =
              status === "present"
                ? ({ nativeEvent: { layout } }) => {
                    this.setState({
                      activeTalkLayout: {
                        height: layout.height,
                        position: layout.y - theme.navbar.height / 2
                      }
                    });
                  }
                : null;

            // methods on Talk
            const onPress = () => {
              let talkIdx = getIndexFromId(talk.id);
              StatusBar.setBarStyle("default", true);

              navigation.navigate("Talk", {
                introduceUI: talkIdx && talkIdx < talks.length - 1,
                nextTalk: getNextTalkFromId(talk.id),
                prevTalk: getPrevTalkFromId(talk.id),
                talk
              });
            };

            return (

            );
          }}
          */
