import axios from "axios";


const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api",
  timeout: 120000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.detail ||
      error.message ||
      "Request failed";
    return Promise.reject(new Error(message));
  },
);

export async function fetchBooks(params = {}) {
  const response = await api.get("/books/", { params });
  return response.data;
}

export async function fetchBookDetail(id) {
  const response = await api.get(`/books/${id}/`);
  return response.data;
}

export async function fetchRecommendations(id) {
  const response = await api.get(`/books/${id}/recommendations/`);
  return response.data;
}

export async function triggerScrape(payload) {
  const response = await api.post("/books/scrape/", payload);
  return response.data;
}

export async function askQuestion(question, topK = 5) {
  const response = await api.post("/books/ask/", { question, top_k: topK });
  return response.data;
}

export async function fetchChatHistory() {
  const response = await api.get("/chat/history/");
  return response.data;
}
