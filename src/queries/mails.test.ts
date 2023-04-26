import { expect } from "chai";
import { assert, createSandbox, fake, SinonSpy } from "sinon"

// Dependencies to be stubbed
const sgMail = require("@sendgrid/mail");

// Unit under test
const mailer = require("./mails");

const sandbox = createSandbox();

describe("Send reset password email", () => {
    const testEmail = 'douglas.quaid@yahoomail.com';
    const testFirstName = 'douglas';
    const testResetLink = 'https://app.landexplorer.coop/auth?email=douglas.quaid%40yahoomail.com&reset_token=RQMG8R2WJHDEYTAIU1PA4SU7CRXC9WTWTEPDID5MB9MNKNBW2VV87UM2HXLUJZZK'
    const expiryHours = 24;

    let fakeSend: SinonSpy;

    beforeEach(() => {
        fakeSend = sandbox.replace(sgMail, "send", fake());
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("email body is correct, with capitalised first name", () => {
        const expectedBody = `Dear Douglas,` +
            `<br /><br />We received a request to reset your Land Explorer password. If you did not make this request, you can safely ignore this email.` +
            `<br /><br />You can reset your password by clicking the link below:` +
            `<br /><br /><a href="${testResetLink}">${testResetLink}</a>` +
            `<br /><br />Please note this link will expire in ${expiryHours} hours. After ${expiryHours} hours, you must submit a new password reset request.` +
            `<br /><br />If clicking the above link does not work try copying and pasting it into your browser.` +
            `<br />If you continue to have problems please feel free to let us know so we can help.` +
            `<br /><br />Many thanks,` +
            `<br /><br />The Digital Commons Team`;

        // Call method under test
        mailer.sendResetPasswordEmail(testEmail, testFirstName, testResetLink, expiryHours);

        const actualBody = fakeSend.getCall(0).args[0].html;
        assert.calledOnce(fakeSend);
        expect(actualBody).to.equal(expectedBody);
    });
});
