import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Modal from "react-modal";
import styles from "./QuickPick.module.css";

const context = createContext<QuickPickContext | undefined>(undefined);
context.displayName = "QuickPick";

function getDisplayItems<T extends QuickPickItem>(
  allItems: ReadonlyArray<T>,
  filter: string,
): T[] {
  // TODO: Find the matching algorithm VS Code uses for consistency
  return allItems
    .filter(
      (item) =>
        item.alwaysShow ||
        item.label.toLocaleLowerCase().includes(filter.toLocaleLowerCase()),
    )
    .sort((a, b) => {
      // Sort items by if they match or not
      // `alwaysShow` items will sort to the bottom if they don't match
      const aMatch = a.label
        .toLocaleLowerCase()
        .includes(filter.toLocaleLowerCase());
      const bMatch = b.label
        .toLocaleLowerCase()
        .includes(filter.toLocaleLowerCase());
      return -(+aMatch - +bMatch);
    });
}

export function useQuickPick(): QuickPickContext {
  const quickPick = useContext(context);
  if (!quickPick) {
    throw new Error(
      "useQuickPick can only be used in a descendant of QuickPickProvider",
    );
  }
  return quickPick;
}

interface QuickInputProps {
  busy?: boolean;
  disabled?: boolean;
  ignoreFocusOut?: boolean;
  isOpen: boolean;
  onDidAccept?: () => void;
  onDidChangeValue: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDidHide?: (event: React.MouseEvent | React.KeyboardEvent) => void;
  password?: boolean;
  placeholder?: string;
  prompt?: string;
  step?: number;
  title?: string;
  totalSteps?: number;
  validationMessage?: string;
  value: string;
  valueSelection?: [number, number];
}

function QuickInput({
  busy = false,
  disabled = false,
  ignoreFocusOut = false,
  isOpen,
  onDidAccept,
  onDidChangeValue,
  onDidHide,
  password,
  placeholder,
  prompt,
  step,
  title,
  totalSteps,
  validationMessage,
  value,
  valueSelection,
}: QuickInputProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    onDidAccept?.();
  }

  return (
    <Modal
      className={styles.root}
      isOpen={isOpen}
      onAfterOpen={() => {
        inputRef.current?.focus();
        const [start, end] = valueSelection ?? [0, value.length];
        inputRef.current?.setSelectionRange(start, end);
      }}
      onRequestClose={onDidHide}
      overlayClassName={styles.overlay}
      shouldCloseOnOverlayClick={!ignoreFocusOut}
    >
      <form onSubmit={handleSubmit}>
        <input
          autoCapitalize="off"
          autoCorrect="off"
          disabled={disabled}
          onChange={onDidChangeValue}
          placeholder={placeholder}
          ref={inputRef}
          spellCheck="false"
          step={step}
          type={password ? "password" : "text"}
          value={value}
        />
        <label>{prompt}</label>
      </form>
    </Modal>
  );
}

export interface QuickPickItem {
  alwaysShow?: boolean;
  description?: string;
  detail?: string;
  key: React.Key;
  label: string;
  picked?: boolean;
}

interface QuickPickProps<T extends QuickPickItem> {
  activeItems?: ReadonlyArray<T>;
  busy?: boolean;
  disabled?: boolean;
  ignoreFocusOut?: boolean;
  isOpen: boolean;
  items: ReadonlyArray<T>;
  onDidAccept?: () => void;
  onDidChangeActive?: (items: T[]) => void;
  onDidChangeSelected?: (items: T[]) => void;
  onDidHide?: (event: React.MouseEvent | React.KeyboardEvent) => void;
  placeholder?: string;
  selectedItems?: ReadonlyArray<T>;
  value?: string;
}

function QuickPick<TItem extends QuickPickItem>({
  activeItems = [],
  busy = false,
  disabled = false,
  ignoreFocusOut = false,
  isOpen,
  items,
  onDidAccept,
  onDidChangeActive,
  onDidChangeSelected,
  onDidHide,
  placeholder,
  selectedItems = [],
  value,
}: QuickPickProps<TItem>): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState(value ?? "");
  const [focus, setFocus] = useState(0);

  const onDidChangeSelectedRef = useRef(onDidChangeSelected);
  onDidChangeSelectedRef.current = onDidChangeSelected;

  const filteredItems = getDisplayItems(items, filter);
  const focusedItem = filteredItems[focus];
  useEffect(() => {
    onDidChangeSelectedRef.current?.([focusedItem]);
  }, [focusedItem]);

  function handleKeyDown(e: React.KeyboardEvent): void {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocus((prev) => (prev + 1) % filteredItems.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocus((prev) => Math.max(0, prev - 1));
        break;
      case "Enter":
        e.preventDefault();
        onDidAccept?.();
        break;
    }
  }

  return (
    <Modal
      className={styles.root}
      isOpen={isOpen}
      onAfterOpen={() => inputRef.current?.focus()}
      onRequestClose={onDidHide}
      overlayClassName={styles.overlay}
      shouldCloseOnOverlayClick={!ignoreFocusOut}
    >
      <div
        className={styles.inputBox}
        onFocus={() => inputRef.current?.focus()}
        onKeyDown={handleKeyDown}
      >
        <input
          autoCapitalize="off"
          autoCorrect="off"
          disabled={disabled}
          onChange={(e) => {
            setFocus(0);
            setFilter(e.target.value);
          }}
          placeholder={placeholder}
          ref={inputRef}
          spellCheck="false"
          type="text"
          value={filter}
        />
      </div>
      <ul role="listbox">
        {filteredItems.map((item, i) => (
          <QuickPickListItem
            {...item}
            active={activeItems.includes(item)}
            focused={i === focus}
            key={item.key}
            onClick={() => {
              onDidChangeSelected?.([item]);
              onDidAccept?.();
            }}
            selected={selectedItems.includes(item)}
          />
        ))}
        {filteredItems.length === 0 && <li>No matching results</li>}
      </ul>
    </Modal>
  );
}

interface QuickPickOptionProps extends QuickPickItem {
  active?: boolean;
  focused?: boolean;
  onClick?: () => void;
  selected?: boolean;
}

function QuickPickListItem({
  active = false,
  description,
  detail,
  focused = false,
  label,
  onClick,
  picked,
}: QuickPickOptionProps): JSX.Element {
  const className = Object.entries({
    [styles.active]: active,
    [styles.focused]: focused,
  })
    .filter(([, value]) => value)
    .map(([key]) => key)
    .join(" ");
  return (
    <li className={className} onClick={onClick} role="option">
      <span>{label}</span>
      {description && <span>{description}</span>}
      {detail && <p>{detail}</p>}
    </li>
  );
}

export interface InputBoxOptions {
  ignoreFocusOut?: boolean;
  password?: boolean;
  placeHolder?: string;
  prompt?: string;
  value?: string;
  valueSelection?: [number, number];
}

export interface QuickPickOptions {
  /**
   * An optional flag to make the picker accept multiple selections,
   * if true the result is an array of picks.
   */
  canPickMany?: boolean;
  /**
   * Set to true to keep the picker open when focus moves to another part
   * of the editor or to another window.
   */
  ignoreFocusOut?: boolean;
  /** An optional flag to include the description when filtering the picks. */
  matchOnDescription?: string;
  /** An optional flag to include the detail when filtering the picks. */
  matchOnDetail?: string;
  /**
   * An optional string to show as placeholder in the input box to guide
   * the user what to pick on.
   */
  placeHolder?: string;
}

export interface QuickPickContext {
  showInputBox(
    options?: InputBoxOptions,
    signal?: AbortSignal,
  ): Promise<string | undefined>;
  /**
   * Shows a selection list.
   * @param items An array of strings, or a promise that resolves to an array of strings.
   * @param options Configures the behavior of the selection list.
   * @param signal A token that can be used to signal cancellation.
   * @returns A promise that resolves with the selection or `undefined`.
   */
  showQuickPick<T extends QuickPickItem>(
    items: T[] | Promise<T[]>,
    options?: QuickPickOptions,
    signal?: AbortSignal,
  ): Promise<T | undefined>;
}

interface InputBoxProviderState {
  isOpen: boolean;
  options: InputBoxOptions;
  resolve(value: string | undefined): void;
  value: string;
}

interface QuickPickProviderState<T extends QuickPickItem> {
  busy: boolean;
  isOpen: boolean;
  items: T[];
  options: QuickPickOptions;
  resolve(value: T | undefined): void;
  selectedItems: ReadonlyArray<T>;
}

interface QuickPickProviderProps {
  children: React.ReactNode;
}

export function QuickPickProvider({
  children,
}: QuickPickProviderProps): JSX.Element {
  const [quickPick, setState] = useState<QuickPickProviderState<QuickPickItem>>(
    {
      busy: false,
      isOpen: false,
      items: [],
      options: {},
      resolve() {},
      selectedItems: [],
    },
  );
  const [inputBox, setInputBox] = useState<InputBoxProviderState>({
    isOpen: false,
    options: {},
    resolve() {},
    value: "",
  });

  const value = useMemo<QuickPickContext>(() => {
    return {
      showInputBox(options = {}, signal) {
        return new Promise<string | undefined>((resolve, reject) => {
          // TODO: Does the VS Code API reject or resolve with undefined on abort?
          signal?.addEventListener("abort", (e) => reject(e));
          setInputBox({
            isOpen: true,
            options,
            resolve,
            value: options.value ?? "",
          });
        });
      },
      showQuickPick<T extends QuickPickItem>(
        items: T[] | Promise<T[]>,
        options: QuickPickOptions = {},
        signal?: AbortSignal,
      ): Promise<T | undefined> {
        return new Promise<T | undefined>((resolve, reject) => {
          // TODO: Does the VS Code API reject or resolve with undefined on abort?
          signal?.addEventListener("abort", (e) => reject(e));

          if (Array.isArray(items)) {
            const nextState: QuickPickProviderState<T> = {
              busy: false,
              isOpen: true,
              items,
              options,
              resolve,
              selectedItems: [],
            };
            setState(nextState);
          } else {
            const nextState: QuickPickProviderState<T> = {
              busy: true,
              isOpen: true,
              items: [],
              options,
              resolve,
              selectedItems: [],
            };
            setState(nextState);

            items.then((x) => {
              if (!signal?.aborted) {
                setState((prev) => {
                  return {
                    ...prev,
                    busy: false,
                    items: x,
                  };
                });
              }
            });
          }
        });
      },
    };
  }, []);

  return (
    <context.Provider value={value}>
      {children}
      <QuickPick
        busy={quickPick.busy}
        ignoreFocusOut={quickPick.options.ignoreFocusOut}
        isOpen={quickPick.isOpen}
        items={quickPick.items}
        onDidAccept={() => {
          setState((prev) => {
            quickPick.resolve(prev.selectedItems[0]);
            return { ...prev, isOpen: false };
          });
        }}
        onDidChangeSelected={(selectedItems) => {
          setState((prev) => {
            return { ...prev, selectedItems };
          });
        }}
        onDidHide={() => {
          quickPick.resolve(undefined);
          setState((prev) => {
            return { ...prev, isOpen: false };
          });
        }}
        placeholder={quickPick.options.placeHolder}
        selectedItems={quickPick.selectedItems}
      />
      <QuickInput
        ignoreFocusOut={inputBox.options.ignoreFocusOut}
        isOpen={inputBox.isOpen}
        onDidAccept={() => {
          inputBox.resolve(inputBox.value);
          setInputBox((prev) => {
            return { ...prev, isOpen: false };
          });
        }}
        onDidChangeValue={(e) => {
          setInputBox((prev) => {
            return { ...prev, value: e.target.value };
          });
        }}
        onDidHide={() => {
          inputBox.resolve(undefined);
          setInputBox((prev) => {
            return { ...prev, isOpen: false };
          });
        }}
        password={inputBox.options.password}
        placeholder={inputBox.options.placeHolder}
        prompt={inputBox.options.prompt}
        value={inputBox.value}
        valueSelection={inputBox.options.valueSelection}
      />
    </context.Provider>
  );
}
