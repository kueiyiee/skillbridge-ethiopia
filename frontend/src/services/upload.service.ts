export async function uploadFile(file: File) {
  return {
    url: `https://example.com/uploads/${file.name}`,
    fileName: file.name,
  };
}
