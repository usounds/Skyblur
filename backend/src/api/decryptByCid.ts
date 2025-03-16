import { Context } from 'hono'
import { UkSkyblurPostDecryptByCid } from '../lexicon/UkSkyblur'
import { getDecrypt } from '../logic/CryptHandler'

export const handle = async (c: Context) => {
    let { pds, repo, cid, password } = await c.req.json() as UkSkyblurPostDecryptByCid.Input

    if (!pds) {
        return c.json({ message: 'pds is required.' }, 500);
    }
    if (!repo) {
        return c.json({ message: 'repo is required.' }, 500);
    }
    if (!cid) {
        return c.json({ message: 'cid is required.' }, 500);
    }
    if (!password) {
        return c.json({ message: 'password is required.' }, 500);
    }

    return await getDecrypt(c, pds, repo, cid, password)

}