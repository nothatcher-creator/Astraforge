/** Timeline coordinates include the sticky track labels. Time is in milliseconds. */
export function timeAtPosition(x:number, labelWidth:number, scale:number, duration:number) {
  return Math.round(Math.max(0,Math.min(duration,(x-labelWidth)/scale*1000)));
}

export function fitTimelineScale(viewportWidth:number,labelWidth:number,duration:number) {
  return Math.max(.01,Math.min(600,(Math.max(1,viewportWidth-labelWidth-24))/Math.max(.001,duration/1000)));
}
