/** Dev-only: throws during render so the error boundary can be tested. */
export default function ThrowPage(): never {
  throw new Error("Intentional test error from /dev/throw");
}
