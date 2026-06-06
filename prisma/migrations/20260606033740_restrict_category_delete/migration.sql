-- DropForeignKey
ALTER TABLE "Movement" DROP CONSTRAINT "Movement_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "RecurringRule" DROP CONSTRAINT "RecurringRule_categoryId_fkey";

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
