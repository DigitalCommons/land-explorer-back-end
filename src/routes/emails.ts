import { Request, ResponseToolkit, ResponseObject, ServerRoute } from "@hapi/hapi";

async function addToMailingList(request: Request, h: ResponseToolkit): Promise<ResponseObject> {
    const email = {
        message: "adding you to mailing list"
    }

    return h.response(email);
}

export const emailRoutes: ServerRoute[] = [
    { method: "GET", path: "/mailinglist", handler: addToMailingList, options: { auth: false } },
];