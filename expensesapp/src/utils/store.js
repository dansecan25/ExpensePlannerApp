
import {types} from "mobx-state-tree";
import { createContext } from "react";


const Storage = types.model({
    
}).actions(self=> ({

}))

export const storage = Storage.create({});
export const Context = createContext();