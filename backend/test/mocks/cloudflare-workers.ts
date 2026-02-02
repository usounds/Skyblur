export class DurableObject {
    public ctx: any;
    public env: any;

    constructor(state: any, env: any) {
        this.ctx = state;
        this.env = env;
    }
}
