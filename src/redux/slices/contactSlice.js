import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  contacts: [],
};

const contactSlice = createSlice({
  name: 'contacts',
  initialState,
  reducers: {
    setContacts: (state, action) => {
      // Expects an array of formatted contacts
      state.contacts = action.payload;
    },
    clearContacts: (state) => {
      state.contacts = [];
    },
  },
});

export const { setContacts, clearContacts } = contactSlice.actions;
export default contactSlice.reducer;
