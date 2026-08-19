export function timingSafeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  const paddedLeft = new Uint8Array(maxLength);
  const paddedRight = new Uint8Array(maxLength);
  paddedLeft.set(leftBytes);
  paddedRight.set(rightBytes);

  let mismatch = leftBytes.length === rightBytes.length ? 0 : 1;
  for (let i = 0; i < maxLength; i++) {
    mismatch |= paddedLeft[i] ^ paddedRight[i];
  }
  return mismatch === 0;
}
