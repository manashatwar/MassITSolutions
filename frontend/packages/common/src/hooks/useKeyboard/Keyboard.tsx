import { create } from 'zustand';

interface KeyboardControl {
  keyboardIsOpen: boolean;
  keyboardIsEnabled: boolean;
  keyboardHeight: number;
}

export const useKeyboard = create<KeyboardControl>(set => {
  return {
    keyboardIsEnabled: false,
    keyboardIsOpen: false,
    keyboardHeight: 0,
  };
});
