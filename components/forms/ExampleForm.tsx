import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Alert, TextInput, View } from 'react-native';
import { z } from 'zod';
import { Button } from '@/components/nativewindui/Button';
import { Text } from '@/components/nativewindui/Text';

/**
 * Example form using react-hook-form + zod
 *
 * This is a template you can copy and modify for your own forms
 */

// Define validation schema with Zod
const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  age: z.number().min(18, 'Must be at least 18').max(120, 'Invalid age'),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
});

// Infer TypeScript type from schema
type FormData = z.infer<typeof formSchema>;

interface ExampleFormProps {
  onSubmit: (data: FormData) => void | Promise<void>;
  defaultValues?: Partial<FormData>;
  isLoading?: boolean;
}

export function ExampleForm({ onSubmit, defaultValues, isLoading }: ExampleFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      age: 18,
      bio: '',
      ...defaultValues,
    },
  });

  const onSubmitForm = async (data: FormData) => {
    try {
      await onSubmit(data);
      Alert.alert('Success', 'Form submitted successfully!');
      reset();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Something went wrong');
    }
  };

  return (
    <View className="gap-4 p-4">
      {/* Name Field */}
      <View className="gap-2">
        <Text variant="subhead" className="font-semibold">
          Name *
        </Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              placeholder="Enter your name"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              editable={!isLoading && !isSubmitting}
            />
          )}
        />
        {errors.name && (
          <Text variant="footnote" className="text-red-500">
            {errors.name.message}
          </Text>
        )}
      </View>

      {/* Email Field */}
      <View className="gap-2">
        <Text variant="subhead" className="font-semibold">
          Email *
        </Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              editable={!isLoading && !isSubmitting}
            />
          )}
        />
        {errors.email && (
          <Text variant="footnote" className="text-red-500">
            {errors.email.message}
          </Text>
        )}
      </View>

      {/* Age Field */}
      <View className="gap-2">
        <Text variant="subhead" className="font-semibold">
          Age *
        </Text>
        <Controller
          control={control}
          name="age"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              placeholder="Enter your age"
              keyboardType="numeric"
              onBlur={onBlur}
              onChangeText={(text) => onChange(parseInt(text, 10) || 0)}
              value={value.toString()}
              editable={!isLoading && !isSubmitting}
            />
          )}
        />
        {errors.age && (
          <Text variant="footnote" className="text-red-500">
            {errors.age.message}
          </Text>
        )}
      </View>

      {/* Bio Field (Optional) */}
      <View className="gap-2">
        <Text variant="subhead" className="font-semibold">
          Bio
        </Text>
        <Controller
          control={control}
          name="bio"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="rounded-lg border border-border bg-card px-4 py-3 text-foreground"
              placeholder="Tell us about yourself"
              multiline
              numberOfLines={4}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              editable={!isLoading && !isSubmitting}
            />
          )}
        />
        {errors.bio && (
          <Text variant="footnote" className="text-red-500">
            {errors.bio.message}
          </Text>
        )}
      </View>

      {/* Submit Button */}
      <Button
        onPress={handleSubmit(onSubmitForm)}
        disabled={isLoading || isSubmitting}
        className="mt-4"
      >
        <Text>{isLoading || isSubmitting ? 'Submitting...' : 'Submit'}</Text>
      </Button>
    </View>
  );
}
