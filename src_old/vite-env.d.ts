/// <reference types="vite/client" />

// Khai báo module CSS để TypeScript không báo lỗi
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
