import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Dialog } from "primereact/dialog";
import { useState } from "react";

interface TermDialogProps {
    showTermsDialog?: boolean;
    onHide?: () => void;
    onAccept?: () => void;
    onCancel?: () => void;
}

const TermDialog: React.FC<TermDialogProps> = ({
    showTermsDialog,
    onHide,
    onAccept,
    onCancel,
}) => {
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    const termsFooterContent = (
        <div className="flex justify-end gap-2">
            <Button
                label="取消"
                icon="pi pi-times"
                onClick={onCancel}
                className="p-button-text rounded-2xl"
            />
            <Button
                label="我已知晓"
                icon="pi pi-check"
                onClick={() => {
                    if (agreedToTerms) onAccept();
                }}
                disabled={!agreedToTerms}
                className="p-button-primary rounded-2xl"
            />
        </div>
    );

    return (
        <Dialog
            header="服务条款确认"
            visible={showTermsDialog}
            onHide={onHide}
            footer={termsFooterContent}
            modal
            draggable={false}
            resizable={false}
            style={{ width: '90%', maxWidth: '500px' }}
        >
            <div className="p-4">
                <div className="mb-4 text-surface-900">
                    <h3 className="font-bold text-lg mb-2">请仔细阅读以下服务条款：</h3>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>未来我们很快会支持全链路的支付，不再需要您点击确认，当前只是过度方案。</li>
                        <li>支付完成后，请主动联系教练确认收款</li>
                        <li>教练确认收款后，服务即生效</li>
                    </ul>
                </div>
                <div className="flex items-center mb-4">
                    <Checkbox
                        inputId="agreement"
                        onChange={e => setAgreedToTerms(e.checked || false)}
                        checked={agreedToTerms}
                    />
                    <label htmlFor="agreement" className="ml-2 text-surface-900">
                        我已阅读并同意以上服务条款
                    </label>
                </div>
            </div>
        </Dialog>
    )
}

export default TermDialog;