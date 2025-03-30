import { Request, Response } from 'express';

export const getProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const productId = req.params.id;

        // Mock data for demonstration purposes
        const product = {
            id: productId,
            name: 'Sample Product',
            price: 99.99,
            description: 'This is a sample product description.',
        };

        res.status(200).json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};