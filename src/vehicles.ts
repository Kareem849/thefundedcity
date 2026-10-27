// Registry of everything the character can ride: cars, golf carts, ships, yachts, sailboats,
// airliners, small planes and helicopters. Every model faces +x (forward) like the rest of the city.
// While a vehicle is controlled by the player, its owner's AI must skip it (`obj.userData.controlled`).
import * as THREE from 'three';

export type VehicleKind = 'car' | 'boat' | 'plane' | 'heli';

export interface Vehicle {
  id: string;
  kind: VehicleKind;
  name: string;
  /** e.g. "Boeing 777", "Motor yacht", "City car" */
  model: string;
  obj: THREE.Object3D;
  /** top speed in world units / s */
  maxSpeed: number;
  /** spinning props/rotors, animated while the player flies */
  spinners?: THREE.Object3D[];
  /** landing gear (shown on the ground) */
  gear?: THREE.Object3D | null;
  /** half length, for collision look-ahead */
  halfLength: number;
  /** extra height of the wheels/hull reference above the ground or water */
  rideY?: number;
}

const list: Vehicle[] = [];
export function registerVehicle(v: Vehicle) {
  v.obj.userData.vehicleId = v.id;
  v.obj.traverse((o) => (o.userData.vehicleId = v.id));
  list.push(v);
  return v;
}
export const vehicles = () => list;
export const vehicleById = (id: string) => list.find((v) => v.id === id) ?? null;
export const isControlled = (o: THREE.Object3D) => !!o.userData.controlled;

export const KIND_VERB: Record<VehicleKind, string> = { car: 'Driving', boat: 'Sailing', plane: 'Flying', heli: 'Piloting' };
export const KIND_ACTION: Record<VehicleKind, string> = { car: 'Drive', boat: 'Sail', plane: 'Fly', heli: 'Pilot' };
