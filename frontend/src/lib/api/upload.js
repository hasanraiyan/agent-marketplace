import { api } from "./core";

export const uploadAvatar = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/upload/avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};
