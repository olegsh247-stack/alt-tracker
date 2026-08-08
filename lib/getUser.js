import { cookies } from 'next/headers';
import { verifySessionValue } from './session';

export function getUserId() {
  const cookie = cookies().get('session')?.value;
  return verifySessionValue(cookie);
}
