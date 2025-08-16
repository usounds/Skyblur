import { jwks } from "../logic/type";
import { Context } from 'hono'

export const handle = async (c: Context) => {
    return c.json(jwks)

}