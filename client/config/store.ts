import { configureStore } from "@reduxjs/toolkit";
import { useDispatch } from "react-redux";
import chatReducer from "@/redux/chatsSlice";

export const store = configureStore({
  reducer: {
    chats: chatReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
