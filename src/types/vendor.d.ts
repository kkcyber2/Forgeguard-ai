/**
 * Type stubs for packages that install at Vercel build time.
 * Prevents TSC from erroring in dev/sandbox when node_modules
 * haven't been fully hydrated from the mounted FUSE drive.
 * skipLibCheck:true handles the rest.
 */

declare module "three" {
  export * from "three/src/Three";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const WebGLRenderer: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class Vector3 { constructor(x?: number, y?: number, z?: number); x: number; y: number; z: number; }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const BufferGeometry: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Float32BufferAttribute: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const PointsMaterial: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Points: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Color: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const AdditiveBlending: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const MathUtils: any;
}

declare module "@react-three/fiber" {
  import * as React from "react";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function Canvas(props: any): React.ReactElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useFrame(callback: (state: any, delta: number) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useThree(): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function extend(objects: Record<string, any>): void;
}

declare module "@react-three/drei" {
  import * as React from "react";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function OrbitControls(props?: any): React.ReactElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function Preload(props?: any): React.ReactElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function AdaptiveDpr(props?: any): React.ReactElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function AdaptiveEvents(props?: any): React.ReactElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function PerformanceMonitor(props?: any): React.ReactElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function Stars(props?: any): React.ReactElement;
}

declare module "react-signature-canvas" {
  import * as React from "react";
  export interface SignatureCanvasProps {
    penColor?: string;
    canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>;
    backgroundColor?: string;
    dotSize?: number | (() => number);
    minWidth?: number;
    maxWidth?: number;
    throttle?: number;
    velocityFilterWeight?: number;
    onBegin?: () => void;
    onEnd?: () => void;
    clearOnResize?: boolean;
  }
  export default class SignatureCanvas extends React.Component<SignatureCanvasProps> {
    clear(): void;
    isEmpty(): boolean;
    toDataURL(type?: string, encoderOptions?: number): string;
    toData(): object[][];
    fromData(pointGroups: object[][]): void;
    fromDataURL(dataURL: string, options?: object): void;
    on(): void;
    off(): void;
    getCanvas(): HTMLCanvasElement;
    getTrimmedCanvas(): HTMLCanvasElement;
    getSignaturePad(): object;
  }
}
