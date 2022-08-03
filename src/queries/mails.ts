const { QueryTypes } = require('sequelize');
const { sequelize, User, Map, UserMap, PendingUserMap } = require('./database');
const bcrypt = require('bcrypt');

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

let loginLink = "https://app.landexplorer.coop/auth/";
let sender = "landexplorer@digitalcommons.coop";
let senderName = "Land Explorer";

export const sendRegisterEmail = async (recipient: string, name: string) => {
  let body = `Dear ${name},`;
  body += "<br /><br />Thank you for registering with Land Explorer.";
  body += "<br />You can <a href=\"" + loginLink + "\">login here</a>.";
  body += "<br />We're excited to see how you use this tool, to find information on the land around you!";
  body += "<br /><br />Many thanks,";
  body += "<br />The Digital Commons Team";

  const msg = {
    to: recipient,
    from: {
      name: senderName,
      email: sender
    },
    subject: name + ", you have registered on Land Explorer!",
    html: body,
  };

  sgMail.send(msg).catch((error: Error) => {
    console.error(error);
  });
}

export const resetPassword = async (recipient: string, name: string, newPassword: string) => {
  let body = "Dear " + capitalizeFirstLetter(name) + ",";
  body += "<br /><br />Here is your new password: " + newPassword;
  body += "<br />You can <a href=\"" + loginLink + "\">login here</a>.";
  body += "<br />You can change your password to something more memorable in My Account, once logged in.";
  body += "<br /><br />Many thanks,";
  body += "<br />The Digital Commons Team";

  const msg = {
    to: recipient,
    from: {
      name: senderName,
      email: sender
    },
    subject: name + ", you have reset your Land Explorer password",
    html: body,
  };

  sgMail.send(msg).catch((error: Error) => {
    console.error(error);
  });
}

export const resetPasswordNotFound = async (recipient: string) => {

  let body = "Hi,";
  body += "<br /><br />You received this message because you requested for a Land Explorer account password reset.";
  body += "<br />However, there is no Land Explorer account associated with this email.";
  body += "<br />If you requested this password reset, a different email address might have been used for the Land Explorer account.";
  body += "<br /><br />Many thanks,";
  body += "<br />The Digital Commons Team";

  const msg = {
    to: recipient,
    from: {
      name: senderName,
      email: sender
    },
    subject: "You don't have a Land Explorer account at this email",
    html: body,
  };

  sgMail.send(msg).catch((error: Error) => {
    console.error(error);
  });
}

export const shareMapRegistered = async (
  recipient: string,
  recipient_firstname: string,
  sharer_fullname: string,
  sharer_firstname: string,
  map_name: string,
) => {

  let body = "<!DOCTYPE html><html lang=\"en\" xmlns=\"http://www.w3.org/1999/xhtml\"><head></head><body>'";
  body += "<p>Dear " + capitalizeFirstLetter(recipient_firstname) + ",</p>";
  body += "<p>" + capitalizeFirstLetter(sharer_fullname) + " has invited you to join Land Explorer and has given you access to their map: " + map_name + "</p>";
  body += "<p>You can register for an account by clicking <a href=\"" + loginLink + "\">here</a>.</p>";
  body += "<p>Once logged in, you can then view the map " + capitalizeFirstLetter(sharer_firstname) + " shared with you.</p>";
  body += "<p>Many thanks,<br/><br/>The Digital Commons Team</p>";
  body += "</body></html>";

  const msg = {
    to: recipient,
    from: {
      name: senderName,
      email: sender
    },
    subject: recipient_firstname + `, ${sharer_fullname} has shared a Land Explorer map with you`,
    html: body,
  };

  sgMail.send(msg).catch((error: Error) => {
    console.error(error);
  });
}



export const shareMapUnregistered = async (
  recipient: string,
  sharer_fullname: string,
  sharer_firstname: string,
  map_name: string,
) => {

  let body = "<!DOCTYPE html><html lang=\"en\" xmlns=\"http://www.w3.org/1999/xhtml\"><head></head><body>'";
  body += "<p>Hi There,</p>";
  body += "<p>" + capitalizeFirstLetter(sharer_fullname) + " has invited you to join Land Explorer and has given you access to their map: " + map_name + "</p>";
  body += "<p>You can register for an account by clicking <a href=\"" + loginLink + "\">here</a>.</p>";
  body += "<p>Once logged in, you can then view the map " + capitalizeFirstLetter(sharer_firstname) + " shared with you.</p>";
  body += "<p>Many thanks,<br/><br/>The Digital Commons Team</p>";
  body += "</body></html>";

  const msg = {
    to: recipient,
    from: {
      name: senderName,
      email: sender
    },
    subject: `${sharer_fullname} has shared a Land Explorer map with you and invited you to register`,
    html: body,
  };

  sgMail.send(msg).catch((error: Error) => {
    console.error(error);
  });
}

function capitalizeFirstLetter(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}