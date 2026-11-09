import mongoose from 'mongoose';

const curateCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Category name is required'], trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    displayName: { type: String, trim: true },
    image: {
      url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },
    description: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

curateCategorySchema.index({ sortOrder: 1, name: 1 });
curateCategorySchema.index({ isActive: 1 });

export default mongoose.model('CurateCategory', curateCategorySchema);
