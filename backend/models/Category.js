import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Category name is required'], trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    image: {
      url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },
    isActive: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    order: { type: Number, default: 0 },

    // Curate Look Stage Synchronized Configuration
    curateLook: {
      enabled: { type: Boolean, default: true },
      displayName: { type: String, default: '' },
      rules: {
        requiresColor: { type: Boolean, default: false },
        requiresSize: { type: Boolean, default: false },
      },
    },
  },
  { timestamps: true }
);

categorySchema.index({ displayOrder: 1, name: 1 });
categorySchema.index({ isActive: 1 });

categorySchema.pre('save', function (next) {
  if (this.order !== undefined && (this.displayOrder === 0 || this.displayOrder === undefined)) {
    this.displayOrder = this.order;
  }
  if (this.displayOrder !== undefined && (this.order === 0 || this.order === undefined)) {
    this.order = this.displayOrder;
  }
  if (this.active !== undefined && this.isActive === undefined) {
    this.isActive = this.active;
  }
  if (this.isActive !== undefined) {
    this.active = this.isActive;
  }
  if (!this.curateLook?.displayName) {
    this.curateLook.displayName = this.name;
  }
  next();
});

export default mongoose.model('Category', categorySchema);
