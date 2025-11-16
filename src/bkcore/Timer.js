/**
 * new Date().getTime() wrapper to use as timer.
 *
 * @class bkcore.Timer
 * @author Thibaut 'BKcore' Despoulain <http://bkcore.com>
 */
export class Timer {
  /**
   * Creates a new timer, inactive by default.
   * Call Timer.start() to activate.
   */
  constructor() {
    this.time = {
      start: 0,
      current: 0,
      previous: 0,
      elapsed: 0,
      delta: 0
    };

    this.active = false;
  }

  /**
   * Starts/restarts the timer.
   */
  start() {
    const now = new Date().getTime();

    this.time.start = now;
    this.time.current = now;
    this.time.previous = now;
    this.time.elapsed = 0;
    this.time.delta = 0;

    this.active = true;
  }

  /**
   * Pauses(true)/Unpauses(false) the timer.
   *
   * @param bool Do pause
   */
  pause(doPause) {
    this.active = !doPause;
  }

  /**
   * Update method to be called inside a RAF loop
   */
  update() {
    if (!this.active) return;

    const now = new Date().getTime();

    this.time.current = now;
    this.time.elapsed = this.time.current - this.time.start;
    this.time.delta = now - this.time.previous;
    this.time.previous = now;
  }

  /**
   * Returns a formatted version of the current elapsed time using msToTime().
   */
  getElapsedTime() {
    return this.constructor.msToTime(this.time.elapsed);
  }

  /**
   * Formats a millisecond integer into a h/m/s/ms object
   *
   * @param x int In milliseconds
   * @return Object{h,m,s,ms}
   */
  static msToTime(t) {
    const ms = t % 1000;
    const s = Math.floor((t / 1000) % 60);
    const m = Math.floor((t / 60000) % 60);
    const h = Math.floor(t / 3600000);

    return { h: h, m: m, s: s, ms: ms };
  }

  /**
   * Formats a millisecond integer into a h/m/s/ms object with prefix zeros
   *
   * @param x int In milliseconds
   * @return Object<string>{h,m,s,ms}
   */
  static msToTimeString(t) {
    const time = Timer.msToTime(t);

    time.h = Timer.zfill(time.h, 2);
    time.m = Timer.zfill(time.m, 2);
    time.s = Timer.zfill(time.s, 2);
    time.ms = Timer.zfill(time.ms, 4);

    return time;
  }

  /**
   * Convert given integer to string and fill with heading zeros
   *
   * @param num int Number to convert/fill
   * @param size int Desired string size
   */
  static zfill(num, size) {
    const len = size - num.toString().length;
    return len > 0 ? new Array(len + 1).join('0') + num : num.toString();
  }
}
