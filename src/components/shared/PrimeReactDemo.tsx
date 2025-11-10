import React, { useState } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Card } from 'primereact/card';
import { Divider } from 'primereact/divider';

const PrimeReactDemo: React.FC = () => {
    const [name, setName] = useState('');

    const handleSubmit = () => {
        alert(`Hello, ${name}! Welcome to PrimeReact.`);
    };

    return (
        <div className="p-4">
            <Card title="PrimeReact Demo Component">
                <p className="mb-4">This is a demo component using PrimeReact components.</p>
                
                <Divider />
                
                <div className="flex flex-column gap-3">
                    <div className="p-inputgroup">
                        <span className="p-inputgroup-addon">
                            <i className="pi pi-user"></i>
                        </span>
                        <InputText 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            placeholder="Enter your name"
                        />
                    </div>
                    
                    <Button 
                        label="Submit" 
                        icon="pi pi-check" 
                        onClick={handleSubmit}
                        disabled={!name}
                    />
                </div>
                
                <Divider />
                
                <p className="text-sm text-gray-600">
                    This component demonstrates the usage of PrimeReact components like Button, InputText, Card, and Divider.
                </p>
            </Card>
        </div>
    );
};

export default PrimeReactDemo;