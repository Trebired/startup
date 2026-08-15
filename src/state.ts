type StartupStateFlag = {
  clear: () => void;
  isSet: () => boolean;
  set: () => void;
};

function createStartupStateFlag(initialValue = false): StartupStateFlag {
  let value = initialValue === true;
  return {
    clear() {
      value = false;
    },
    isSet() {
      return value === true;
    },
    set() {
      value = true;
    },
  };
}

export { createStartupStateFlag };
export type { StartupStateFlag };
