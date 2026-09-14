type Request = { width: number; height: number; pixels: ArrayBuffer };

self.onmessage = (event: MessageEvent<Request>) => {
  const { width, height } = event.data;
  const input = new Uint8Array(event.data.pixels);
  const visited = new Uint8Array(input.length);
  const components: number[][] = [];
  const queue = new Int32Array(input.length);
  for (let start = 0; start < input.length; start += 1) {
    if (!input[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    const component: number[] = [];
    while (head < tail) {
      const index = queue[head++];
      component.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      const neighbours = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      for (const [nx, ny] of neighbours) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (input[next] && !visited[next]) {
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (component.length >= 2) components.push(component);
  }
  self.postMessage({ components });
};
