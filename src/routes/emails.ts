import { Request, ResponseToolkit, ResponseObject, ServerRoute } from "@hapi/hapi";

type EmailRequest = Request & {
    payload: {
        email: string;
        name: string;
    }
}

async function addToMailingList(request: EmailRequest, h: ResponseToolkit): Promise<ResponseObject> {
    const result = {
        success: true,
        message: "adding you to mailing list"
    }

    console.log("mailing list called");

    const { email, name } = request.payload;

    console.log(email, name);

    return h.response(result);
}

export const emailRoutes: ServerRoute[] = [
    // Add given email and name to the LX mailing list
    { method: "POST", path: "/mailinglist", handler: addToMailingList, options: { auth: false } },
];
