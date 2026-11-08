import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Platform } from "react-native";

const REVEAL_MARGIN = 12;
const LAYOUT_SETTLE_MS = 60;

// The app runs edge-to-edge, so Android no longer resizes the window for the
// keyboard. Forms add the keyboard's height as scrollable space and scroll the
// field they want visible to the top of the screen.
export const useKeyboardReveal = () => {
  const scrollRef = useRef(null);
  const fieldY = useRef(0);
  const wantsReveal = useRef(false);
  const keyboardIsOpen = useRef(false);
  const revealTimer = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollToField = useCallback(() => {
    clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, fieldY.current - REVEAL_MARGIN),
        animated: true,
      });
    }, LAYOUT_SETTLE_MS);
  }, []);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showListener = Keyboard.addListener(showEvent, event => {
      keyboardIsOpen.current = true;
      setKeyboardHeight(event.endCoordinates.height);
      if (wantsReveal.current) {
        scrollToField();
      }
    });
    const hideListener = Keyboard.addListener(hideEvent, () => {
      keyboardIsOpen.current = false;
      wantsReveal.current = false;
      setKeyboardHeight(0);
    });
    return () => {
      showListener.remove();
      hideListener.remove();
      clearTimeout(revealTimer.current);
    };
  }, [scrollToField]);

  const recordFieldLayout = useCallback(event => {
    fieldY.current = event.nativeEvent.layout.y;
  }, []);

  const revealField = useCallback(() => {
    wantsReveal.current = true;
    if (keyboardIsOpen.current) {
      scrollToField();
    }
  }, [scrollToField]);

  return {
    contentInsetStyle: keyboardHeight
      ? { paddingBottom: keyboardHeight + 40 }
      : null,
    recordFieldLayout,
    revealField,
    scrollRef,
  };
};
