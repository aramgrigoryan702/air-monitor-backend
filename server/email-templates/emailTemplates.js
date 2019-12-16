const { format } = require('date-fns');
const config = require('../config');

module.exports.buildUserInvitationAccepted = function({ email }) {
    let body = `Hi,<br/><br/>
        The user ${email} has been accepted the invitation and  logged in to the system successfully @${format(
        new Date(),
        'YYYY-MM-DDTHH:mm:ss.SSSZ',
    )}<br/><br/> 
        regards,<br/>
       ${module.exports.buildSignatureFooter()}
    `;
    return body;
};

module.exports.buildUserLoggedInForFirstTime = function({ email }) {
    let body = `Hi,<br/><br/>
    
        The user ${email} has logged  in to the project canary system for the first time.'; @${format(
        new Date(),
        'YYYY-MM-DDTHH:mm:ss.SSSZ',
    )} 
        
        regards,
       ${module.exports.buildSignatureFooter()}
    `;
    return body;
};

module.exports.buildUserSignupRequestReceived = function({
    email,
    organization = '',
    name = '',
    phone = '',
}) {
    let body = `Hi,<br/>
        <strong>Action required!</strong><br/>
        A new user ${email} has been submitted request access to the project canary dashboard.
        Contact Details:
        <br/>
        Name: ${name}<br/>
        Organization: ${organization}<br/>
        Email: ${email}<br/>
        Phone: ${phone}<br/>
        <br/>Request time  @${format(
            new Date(),
            'YYYY-MM-DDTHH:mm:ss.SSSZ',
        )}<br/>
        regards,<br/>
        ${module.exports.buildSignatureFooter()}
    `;
    return body;
};

module.exports.buildUserInvitationMessage = function({
    Username,
    TemporaryPassword,
}) {
    let body = `<p>Welcome!</p>
<p>You have been invited to join the Project Canary Dashboard. Your username is ${Username}.&nbsp;&nbsp;
Please accept the invitation and complete your profile by clicking  <a href="https://dashboard.projectcanary.io/accept-invitation/${Username}/${TemporaryPassword}">Accept Invitation</a> .
 </p>
 <p>Please let us know if you have any questions.  You can reach us at info@projectcanary.com or +1-720-432-9767.</p>
 ${module.exports.buildSignatureFooter()}
`;
    return body;
};

module.exports.buildUserAlertMessage = function({
    siteName,
    deviceName,
    alert_values,
    timestamp,
}) {
    let body = `Hi,<br/><br/> 
    This is an automated alert from Project Canary monitoring system informing you that an alert level you set for ${alert_values
        .map(item => {
            return item.property;
        })
        .join(', ')} has been exceeded at ${siteName}.
    <br/>
    At ${timestamp.toString()}, our systems indicate a ${alert_values.map(
        item => {
            return (
                item.property +
                ' reading of <strong>' +
                item.propertyVal +
                '</strong>  at ' +
                siteName +
                ', crossing the alert threshold you set at ' +
                item.compareVal +
                '  ' +
                '\n'
            );
        },
    )} 
    <br/><br/> 
    This alert does not definitively mean a leak or incident has occurred.
    Please do not reply to this automated communication.
    ${module.exports.buildSignatureFooter()}`;

    return body;
};

module.exports.buildSignatureFooter = function() {
    return `<p>Project Canary Team</p>
        <img  src="${
            config.system.logoUrl
        }" alt="Project Canary signature image" style="border:none;clear:both;display:block;height:auto;margin:0 auto; float: left; max-width:120px;outline:0;text-decoration:none;width:120px">`;
};
