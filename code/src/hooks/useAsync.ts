import { DependencyList, Reducer, useEffect, useReducer } from "react";

export type AsyncCallback<T> = (signal: AbortSignal) => Promise<T>;

export type AsyncResult<T> =
  | Readonly<{ data: T; error: null; isLoading: false; status: "complete" }>
  | Readonly<{ data: null; error: Error; isLoading: false; status: "error" }>
  | Readonly<{ data: null; error: null; isLoading: true; status: "loading" }>;

type Action<T> =
  | { type: "loading" }
  | { error: Error; type: "error" }
  | { data: T; type: "complete" };

function reducer<T>(
  _prevState: AsyncResult<T>,
  action: Action<T>,
): AsyncResult<T> {
  switch (action.type) {
    case "complete":
      return {
        data: action.data,
        error: null,
        isLoading: false,
        status: "complete",
      };
    case "error":
      return {
        data: null,
        error: action.error,
        isLoading: false,
        status: "error",
      };
    case "loading":
      return {
        data: null,
        error: null,
        isLoading: true,
        status: "loading",
      };
  }
}

export function useAsync<T>(
  callback: AsyncCallback<T>,
  deps: DependencyList,
): AsyncResult<T> {
  const [state, dispatch] = useReducer<Reducer<AsyncResult<T>, Action<T>>>(
    reducer,
    {
      data: null,
      error: null,
      isLoading: true,
      status: "loading",
    },
  );

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: "loading" });
    callback(controller.signal)
      .then((data) => dispatch({ data, type: "complete" }))
      .catch((error) => dispatch({ error, type: "error" }));
    return () => controller.abort();
  }, deps);

  return state;
}
