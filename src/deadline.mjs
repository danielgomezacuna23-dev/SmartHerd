export async function withDeadline(work, milliseconds, onTimeout) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error("La conexión tardó demasiado. Revisa internet e inténtalo de nuevo."));
    }, milliseconds);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
